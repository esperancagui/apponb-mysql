"""
File uploads — replaces the client's direct-to-Firebase-Storage uploads.
Size limits mirror the old `storage.rules`: 5 MB for branding/avatars
(authenticated), 25 MB for public form-submission attachments.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status

from app.core.auth import get_current_user
from app.core.permissions import require_workspace_member
from app.services import db, storage_service

router = APIRouter()

BRANDING_MAX_BYTES = 5 * 1024 * 1024
SUBMISSION_MAX_BYTES = 25 * 1024 * 1024


async def _read_capped(file: UploadFile, max_bytes: int) -> bytes:
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Arquivo excede o limite de {max_bytes // (1024*1024)} MB.",
        )
    return content


@router.post("/uploads/branding")
async def upload_branding(
    file: UploadFile = File(...),
    kind: str = Form(...),
    workspace_id: str = Form(...),
    current_user: dict = Depends(get_current_user),
):
    if kind not in ("logo", "hero"):
        raise HTTPException(status_code=400, detail="kind deve ser 'logo' ou 'hero'.")
    await require_workspace_member(workspace_id, current_user)
    content = await _read_capped(file, BRANDING_MAX_BYTES)
    url = await storage_service.upload_branding_image(
        content, file.content_type or "application/octet-stream", workspace_id, kind, file.filename or "file"
    )
    return {"url": url}


@router.post("/uploads/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    content = await _read_capped(file, BRANDING_MAX_BYTES)
    url = await storage_service.upload_avatar_image(
        content, file.content_type or "application/octet-stream",
        current_user["firebase_uid"], file.filename or "file",
    )
    return {"url": url}


@router.post("/uploads/submission")
async def upload_submission_file(
    file: UploadFile = File(...),
    form_id: str = Form(...),
    field_id: str = Form(...),
):
    """Public — no auth, matches the old public-write Firebase Storage rule
    for submission attachments. Only requires the target form to exist."""
    form = await db.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Formulário não encontrado.")
    content = await _read_capped(file, SUBMISSION_MAX_BYTES)
    url = await storage_service.upload_submission_file(
        content, file.content_type or "application/octet-stream", form_id, field_id, file.filename or "file"
    )
    return {"url": url}


@router.delete("/uploads", status_code=status.HTTP_204_NO_CONTENT)
async def delete_upload(url: str = Query(...), current_user: dict = Depends(get_current_user)):
    """Best-effort delete by URL — no ownership check (mirrors the old
    Firebase Storage rules, which only gated writes, not deletes, on auth)."""
    await storage_service.delete_by_url(url)
