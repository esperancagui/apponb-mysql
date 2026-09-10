import asyncio
import io
import re
import zipfile
from urllib.parse import unquote

import requests as _requests
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import Any

from app.core.auth import get_current_user
from app.core.permissions import require_submission_access
from app.core.plan_limits import check_response_limit
from app.services import firestore_db
from app.services.queue import get_pool
from app.schemas.submission import SubmissionCreate, SubmissionOut
from app.sockets import broadcaster

router = APIRouter()


@router.post(
    "/submissions",
    status_code=status.HTTP_201_CREATED,
    response_model=SubmissionOut,
    response_model_exclude_none=True,
)
async def create_submission(body: SubmissionCreate):
    payload = body.model_dump()

    # Verify the form actually exists before accepting a submission
    form = await firestore_db.get_form(payload["formId"])
    if not form:
        raise HTTPException(status_code=404, detail="Formulário não encontrado")

    # Check monthly response limit based on workspace owner's plan
    workspace_id = form.get("workspaceId")
    if workspace_id:
        await check_response_limit(workspace_id)

    submission = await firestore_db.create_submission(payload)

    # Enqueue AI analysis in ARQ (persistent, with retry)
    submission_id = submission.get("id")
    if submission_id:
        pool = get_pool()
        await pool.enqueue_job(
            "run_analysis_job",
            submission_id,
            _job_id=f"analysis:{submission_id}",
        )
        await firestore_db.update_submission_field(submission_id, "aiAnalysisStatus", "pending")

    # Broadcast new submission to workspace room (best-effort, reuse already-fetched form)
    workspace_id = submission.get("workspaceId") or form.get("workspaceId")
    form_name = form.get("name") or "Formulário"
    client_name = form.get("clientName") or form_name

    if workspace_id and submission_id:
        try:
            await broadcaster.emit_new_submission(
                workspace_id, submission_id, form_name, client_name
            )
        except Exception:
            pass

    return submission


@router.get(
    "/submissions/{submission_id}",
    response_model=SubmissionOut,
    response_model_exclude_none=True,
)
async def get_submission(
    submission_id: str, current_user: dict = Depends(get_current_user)
):
    sub = await require_submission_access(submission_id, current_user, min_role="viewer")
    return sub


@router.get("/submissions/{submission_id}/files/zip")
async def download_files_zip(
    submission_id: str,
    current_user: dict = Depends(get_current_user),
):
    sub = await require_submission_access(submission_id, current_user, min_role="viewer")
    files: dict = sub.get("files") or {}

    if not files:
        raise HTTPException(status_code=404, detail="Nenhum arquivo encontrado")

    # Normalise: Firestore may store strings (legacy) or lists
    def _to_list(v):
        return [v] if isinstance(v, str) else list(v)

    all_urls = [url for v in files.values() for url in _to_list(v)]

    def _build_zip() -> io.BytesIO:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            seen: dict[str, int] = {}
            for url in all_urls:
                try:
                    r = _requests.get(url, timeout=30)
                    r.raise_for_status()
                    path_part = url.split("/o/")[1].split("?")[0]
                    name = unquote(path_part).split("/")[-1]
                    # Deduplicate filenames
                    if name in seen:
                        seen[name] += 1
                        base, _, ext = name.rpartition(".")
                        name = (
                            f"{base}_{seen[name]}.{ext}"
                            if ext
                            else f"{name}_{seen[name]}"
                        )
                    else:
                        seen[name] = 0
                    zf.writestr(name, r.content)
                except Exception:
                    pass
        buf.seek(0)
        return buf

    buf = await asyncio.to_thread(_build_zip)
    client_name = sub.get("clientName") or "Anexos"
    safe_name = re.sub(r'[/\\?%*:|"<>]', "-", f"{client_name} - Arquivos.zip")

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )
