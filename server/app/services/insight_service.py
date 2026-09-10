"""
Central AI analysis logic — used by both the ARQ worker and the HTTP route.
Does NOT call broadcaster; that is the caller's responsibility.
"""

import logging
from app.services import firestore_db, ai_service, gemini_service

logger = logging.getLogger(__name__)


async def _get_workspace_owner_plan(workspace_id: str) -> str:
    """Resolve the plan of the workspace owner. Returns 'free' on any failure."""
    try:
        workspace = await firestore_db.get_workspace(workspace_id)
        if not workspace:
            return "free"
        owner_uid = workspace.get("ownerId", "")
        if not owner_uid:
            return "free"
        user = await firestore_db.get_user_by_firebase_uid(owner_uid)
        return (user or {}).get("plan", "free")
    except Exception:
        return "free"


async def run_analysis(submission_id: str) -> dict:
    """
    Execute AI analysis for a submission.

    Returns:
        {
            "insight": saved_doc,
            "workspaceId": str,
            "insightId": str,
            "aiRisk": str,       # "low" | "medium" | "high"
            "clientName": str,
        }

    Raises an exception on failure (so ARQ can retry).
    """
    submission = await firestore_db.get_submission(submission_id)
    if not submission:
        raise ValueError(f"Submission {submission_id} not found")

    form_id = submission.get("formId", "")
    submission_data = submission.get("data", {})

    # Get form field definitions for context
    form_fields = []
    form = await firestore_db.get_form(form_id) if form_id else None
    if form:
        form_fields = form.get("groups", [])
    else:
        form_fields = submission.get("formGroups", [])

    # Select AI model based on workspace owner's plan
    workspace_id = submission.get("workspaceId", "")
    plan = await _get_workspace_owner_plan(workspace_id) if workspace_id else "free"

    if plan == "premium":
        files = submission.get("files") or {}
        parsed_insight, raw_prompt, raw_response = await gemini_service.generate_insight(
            submission_data, form_fields, files=files or None
        )
        model_used = gemini_service.GEMINI_MODEL
    else:
        parsed_insight, raw_prompt, raw_response = await ai_service.generate_insight(
            submission_data, form_fields
        )
        model_used = ai_service.DEEPSEEK_MODEL

    insight_doc = {
        "submissionId": submission_id,
        "formId": form_id,
        **parsed_insight,
        "rawPrompt": raw_prompt,
        "rawResponse": raw_response,
        "modelUsed": model_used,
    }

    saved = await firestore_db.create_insight(insight_doc)

    try:
        await firestore_db.update_submission_field(
            submission_id, "aiInsightId", saved.get("id", "")
        )
    except Exception:
        pass

    logger.info("Insight generated for submission %s → %s", submission_id, saved.get("id"))

    # Derive risk level from scoreONB classificacao
    classificacao = parsed_insight.get("scoreONB", {}).get("classificacao", "")
    if classificacao == "Crítico":
        ai_risk = "high"
    elif classificacao == "Regular":
        ai_risk = "medium"
    else:
        ai_risk = "low"

    client_name = (
        submission.get("data", {}).get("nome")
        or submission.get("data", {}).get("name")
        or submission.get("clientName")
        or ""
    )

    return {
        "insight": saved,
        "workspaceId": workspace_id,
        "insightId": saved.get("id", ""),
        "aiRisk": ai_risk,
        "clientName": client_name,
    }
