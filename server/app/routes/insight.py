"""
Insight Routes — AI analysis of form submissions.

POST /submissions/{submission_id}/analyze  → triggers DeepSeek analysis
GET  /insights/{submission_id}             → retrieves existing insight
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
import logging

from app.core.auth import get_current_user
from app.core.permissions import require_submission_access
from app.services import db as firestore_db
from app.services import insight_service
from app.services.pdf_service import generate_report_pdf
from app.schemas.insight import InsightOut
from app.sockets import broadcaster

logger = logging.getLogger(__name__)

router = APIRouter()



async def _run_analysis(submission_id: str):
    """Background task that runs the AI analysis and persists results."""
    try:
        result = await insight_service.run_analysis(submission_id)
        workspace_id = result["workspaceId"]
        insight_id = result["insightId"]
        if workspace_id and insight_id:
            try:
                await broadcaster.emit_insight_completed(
                    workspace_id, submission_id, insight_id,
                    ai_risk=result["aiRisk"],
                    client_name=result["clientName"],
                )
            except Exception:
                pass
    except Exception as e:
        logger.exception(
            "Failed to generate insight for submission %s: %s", submission_id, e
        )


@router.post(
    "/submissions/{submission_id}/analyze",
    response_model=InsightOut,
    response_model_exclude_none=True,
)
async def analyze_submission(
    submission_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Trigger AI analysis on a submission.
    If an insight already exists, returns it. Otherwise, runs analysis synchronously.
    """
    await require_submission_access(submission_id, current_user, min_role="member")

    # Check if insight already exists
    existing = await firestore_db.get_insight_by_submission(submission_id)
    if existing:
        return existing

    try:
        result = await insight_service.run_analysis(submission_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )

    return result["insight"]


@router.get(
    "/insights/{submission_id}",
    response_model=InsightOut,
    response_model_exclude_none=True,
)
async def get_insight(
    submission_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return the AI insight for a given submission."""
    await require_submission_access(submission_id, current_user, min_role="viewer")
    insight = await firestore_db.get_insight_by_submission(submission_id)
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight não encontrado para esta submissão",
        )
    return insight


@router.get("/insights/{submission_id}/pdf")
async def export_insight_pdf(
    submission_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate and return a styled PDF report for a submission's AI insight.
    The report is built from a Jinja2 markdown template and rendered via WeasyPrint.
    """
    await require_submission_access(submission_id, current_user, min_role="viewer")

    insight = await firestore_db.get_insight_by_submission(submission_id)
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight não encontrado para esta submissão",
        )

    submission = await firestore_db.get_submission(submission_id)
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submissão não encontrada",
        )

    # Resolve client name from submission data (best-effort)
    sub_data = submission.get("data", {})
    client_name = (
        sub_data.get("nome")
        or sub_data.get("name")
        or sub_data.get("clientName")
        or submission.get("clientName")
        or "Cliente"
    )

    form_name = submission.get("formName") or "Briefing"
    submitted_at = submission.get("submittedAt") or submission.get("createdAt")

    try:
        pdf_bytes = generate_report_pdf(
            insight=insight,
            client_name=client_name,
            form_name=form_name,
            submitted_at=submitted_at,
        )
    except Exception as e:
        logger.exception("PDF generation failed for submission %s: %s", submission_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao gerar o PDF. Verifique se as dependências estão instaladas.",
        )

    safe_name = client_name.replace("/", "-").replace("\\", "-")[:60]
    filename = f"onb-relatorio-{safe_name}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
