from fastapi import APIRouter, Depends, HTTPException, status as http_status, Query
from typing import List, Dict, Optional

from app.core.auth import get_current_user
from app.core.permissions import require_submission_access, _workspace_role
from app.services import db as firestore_db
from app.schemas.submission import SubmissionOut, SubmissionStatusUpdate
from app.sockets import broadcaster

router = APIRouter()


async def _get_submissions_for_user(
    workspace_id: Optional[str], owner_uid: str
) -> List[dict]:
    """Get submissions filtered by workspace, or all submissions across user's workspaces."""
    if workspace_id:
        return await firestore_db.get_submissions_by_workspace(workspace_id)
    # Fallback: aggregate across all user workspaces (owned + member)
    workspaces = await firestore_db.get_workspaces_for_user(owner_uid)
    submissions = []
    seen = set()
    for ws in workspaces:
        subs = await firestore_db.get_submissions_by_workspace(ws.get("id"))
        for s in subs:
            if s["id"] not in seen:
                seen.add(s["id"])
                submissions.append(s)
    return submissions


@router.get(
    "/inbox", response_model=List[SubmissionOut], response_model_exclude_none=True
)
async def get_inbox(
    workspace_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    uid = current_user.get("firebase_uid")

    # When a specific workspace is requested, ensure the caller is a member.
    if workspace_id:
        role = await _workspace_role(workspace_id, uid)
        if role is None:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Acesso negado",
            )

    submissions = await _get_submissions_for_user(workspace_id, uid)

    # Batch-fetch forms to enrich inbox items with display fields
    form_ids = list({s.get("formId") for s in submissions if s.get("formId")})
    form_map: Dict[str, dict] = {}
    for fid in form_ids:
        form = await firestore_db.get_form(fid)
        if form:
            form_map[fid] = form

    # Fetch insights
    sub_ids = [s.get("id") for s in submissions if s.get("id")]
    insights = await firestore_db.get_insights_for_submissions(sub_ids)
    insight_map = {i.get("submissionId"): i for i in insights if i.get("submissionId")}

    enriched = []
    for sub in submissions:
        fid = sub.get("formId")
        form = form_map.get(fid, {})
        sub["formName"] = form.get("name") or sub.get("formName") or "Formulário"
        sub["clientName"] = (
            form.get("clientName") or form.get("name") or sub.get("clientName") or "—"
        )

        # Count total files across all file fields (supports both array and legacy string values)
        files = sub.get("files") or {}
        total = sum(len(v) if isinstance(v, list) else 1 for v in files.values() if v)
        sub["attachments"] = total
        sub["attachmentsOk"] = total  # no validation yet, assume ok

        insight = insight_map.get(sub.get("id"))
        if insight:
            diagnostico = insight.get("diagnosticoEstrategico", {})
            sub["summary"] = diagnostico.get("visaoGeral", "")

            # Evaluate risk from redFlagsEstrategicas
            red_flags = insight.get("redFlagsEstrategicas", [])
            risk = "low"
            for rf in red_flags:
                sev = rf.get("severidade", "").lower()
                if sev == "alta":
                    risk = "high"
                    break
                elif sev == "média" or sev == "media":
                    if risk == "low":
                        risk = "medium"
            sub["aiRisk"] = risk
        else:
            # Fallback
            data = sub.get("data") or {}
            summary_parts = [str(v) for v in list(data.values())[:3] if v]
            sub["summary"] = " · ".join(summary_parts) if summary_parts else ""
            sub["aiRisk"] = "low"

        enriched.append(sub)

    return enriched


@router.get(
    "/inbox/{submission_id}",
    response_model=SubmissionOut,
    response_model_exclude_none=True,
)
async def get_inbox_item(
    submission_id: str, current_user: dict = Depends(get_current_user)
):
    sub = await require_submission_access(submission_id, current_user, min_role="viewer")
    fid = sub.get("formId")
    if fid:
        form = await firestore_db.get_form(fid)
        if form:
            sub["formName"] = form.get("name") or sub.get("formName") or "Formulário"
            sub["clientName"] = (
                form.get("clientName")
                or form.get("name")
                or sub.get("clientName")
                or "—"
            )
    files = sub.get("files") or {}
    total = sum(len(v) if isinstance(v, list) else 1 for v in files.values() if v)
    sub["attachments"] = total
    sub["attachmentsOk"] = total

    insight = await firestore_db.get_insight_by_submission(submission_id)
    if insight:
        diagnostico = insight.get("diagnosticoEstrategico", {})
        sub["summary"] = diagnostico.get("visaoGeral", "")
        red_flags = insight.get("redFlagsEstrategicas", [])
        risk = "low"
        for rf in red_flags:
            sev = rf.get("severidade", "").lower()
            if sev == "alta":
                risk = "high"
                break
            elif sev == "média" or sev == "media":
                if risk == "low":
                    risk = "medium"
        sub["aiRisk"] = risk
    else:
        data = sub.get("data") or {}
        summary_parts = [str(v) for v in list(data.values())[:3] if v]
        sub["summary"] = " · ".join(summary_parts) if summary_parts else ""
        sub["aiRisk"] = "low"

    return sub


@router.patch("/inbox/{submission_id}/status")
async def update_inbox_status(
    submission_id: str,
    body: SubmissionStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    sub = await require_submission_access(submission_id, current_user, min_role="member")
    await firestore_db.update_submission_status(submission_id, body.status)

    workspace_id = sub.get("workspaceId")
    if workspace_id:
        try:
            await broadcaster.emit_status_updated(
                workspace_id=workspace_id,
                submission_id=submission_id,
                status=body.status,
                client_name=sub.get("clientName") or "",
                actor_name=current_user.get("display_name") or current_user.get("email") or "",
                actor_photo_url=current_user.get("photo_url") or "",
                actor_uid=current_user.get("firebase_uid") or "",
            )
        except Exception:
            pass

    return {"updated": True}


@router.get("/dashboard/stats")
async def dashboard_stats(
    workspace_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    owner_uid = current_user.get("firebase_uid")
    if workspace_id:
        forms = await firestore_db.get_forms(workspace_id)
    else:
        workspaces = await firestore_db.get_workspaces_for_user(owner_uid)
        seen_forms = set()
        forms = []
        for ws in workspaces:
            ws_forms = await firestore_db.get_forms(ws.get("id"))
            for f in ws_forms:
                if f["id"] not in seen_forms:
                    seen_forms.add(f["id"])
                    forms.append(f)

    counts = {
        "newCount": 0,
        "reviewingCount": 0,
        "riskCount": 0,
        "avgResponseTimeHours": 0,
    }
    # To avoid high latency, we fetch all submissions and get their IDs
    all_subs = []
    seen_subs = set()
    for f in forms:
        subs = await firestore_db.get_submissions(f.get("id"))
        for s in subs:
            if s["id"] not in seen_subs:
                seen_subs.add(s["id"])
                all_subs.append(s)

    sub_ids = [s.get("id") for s in all_subs if s.get("id")]
    insights = await firestore_db.get_insights_for_submissions(sub_ids)
    insight_map = {i.get("submissionId"): i for i in insights if i.get("submissionId")}

    for s in all_subs:
        st = s.get("status")
        if st == "new":
            counts["newCount"] += 1
        if st == "reviewing":
            counts["reviewingCount"] += 1

        insight = insight_map.get(s.get("id"))
        if insight:
            red_flags = insight.get("redFlagsEstrategicas", [])
            for rf in red_flags:
                if rf.get("severidade", "").lower() == "alta":
                    counts["riskCount"] += 1
                    break
    return counts
