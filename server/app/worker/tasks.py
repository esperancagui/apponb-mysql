"""
ARQ job definitions.
"""

import logging
import os
import httpx

from app.services import insight_service, db as firestore_db

logger = logging.getLogger(__name__)


async def _notify_fastapi(
    workspace_id: str,
    submission_id: str,
    insight_id: str,
    ai_risk: str,
    client_name: str,
) -> None:
    """POST /internal/emit/insight-completed to let FastAPI emit the Socket.IO event."""
    api_base = (os.getenv("API_BASE_URL") or "http://localhost:8000").strip().strip("\"'")
    if api_base and not api_base.startswith(("http://", "https://")):
        api_base = f"http://{api_base}"
    secret = os.getenv("INTERNAL_SECRET", "")
    url = f"{api_base}/internal/emit/insight-completed"
    payload = {
        "workspaceId": workspace_id,
        "submissionId": submission_id,
        "insightId": insight_id,
        "aiRisk": ai_risk,
        "clientName": client_name,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, json=payload, headers={"X-Internal-Secret": secret})
        resp.raise_for_status()


async def run_analysis_job(ctx: dict, submission_id: str) -> None:
    """ARQ job: run AI analysis for a submission with retry support."""
    max_tries: int = ctx.get("job_try", 1)
    logger.info("Starting analysis for submission %s (try %s)", submission_id, max_tries)

    await firestore_db.update_submission_field(submission_id, "aiAnalysisStatus", "processing")

    try:
        result = await insight_service.run_analysis(submission_id)
    except Exception as exc:
        logger.exception("Analysis failed for submission %s: %s", submission_id, exc)
        # On final attempt, mark as failed
        worker_settings_max_tries = int(os.getenv("ARQ_MAX_TRIES", "3"))
        if ctx.get("job_try", 1) >= worker_settings_max_tries:
            await firestore_db.update_submission_field(
                submission_id, "aiAnalysisStatus", "failed"
            )
        raise  # re-raise so ARQ records the failure and may retry

    await firestore_db.update_submission_field(submission_id, "aiAnalysisStatus", "done")

    workspace_id = result["workspaceId"]
    insight_id = result["insightId"]

    if workspace_id and insight_id:
        try:
            await _notify_fastapi(
                workspace_id=workspace_id,
                submission_id=submission_id,
                insight_id=insight_id,
                ai_risk=result["aiRisk"],
                client_name=result["clientName"],
            )
        except Exception as exc:
            logger.warning(
                "Failed to notify FastAPI for submission %s (Socket.IO event not sent): %s",
                submission_id,
                exc,
            )
