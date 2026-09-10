from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional

from app.core.auth import get_current_user
from app.core.permissions import (
    require_form_write,
    require_form_member_access,
    require_workspace_member,
)
from app.services import firestore_db
from app.schemas.form import FormCreate, FormUpdate, FormOut
from app.schemas.submission import SubmissionOut

router = APIRouter()


@router.get("/forms", response_model=List[FormOut], response_model_exclude_none=True)
async def list_forms(
    workspace_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    if workspace_id:
        forms = await firestore_db.get_forms(workspace_id)
    else:
        uid = current_user.get("firebase_uid")
        workspaces = await firestore_db.get_workspaces_for_user(uid)
        seen: set = set()
        forms = []
        for ws in workspaces:
            for f in await firestore_db.get_forms(ws["id"]):
                if f["id"] not in seen:
                    seen.add(f["id"])
                    forms.append(f)
    return forms


@router.post("/forms/cleanup", status_code=status.HTTP_200_OK)
async def cleanup_inactive_forms(current_user: dict = Depends(get_current_user)):
    """Delete draft forms not updated in 7+ days (scoped to user's workspaces)."""
    uid = current_user.get("firebase_uid")
    workspaces = await firestore_db.get_workspaces_for_user(uid)
    ws_ids = [ws["id"] for ws in workspaces]
    deleted = await firestore_db.cleanup_inactive_draft_forms(workspace_ids=ws_ids)
    return {"deleted": deleted}


@router.post(
    "/forms",
    status_code=status.HTTP_201_CREATED,
    response_model=FormOut,
    response_model_exclude_none=True,
)
async def create_form(body: FormCreate, current_user: dict = Depends(get_current_user)):
    payload = body.model_dump()
    owner_uid = current_user.get("firebase_uid")
    payload["ownerId"] = owner_uid

    # Auto-assign workspace if not provided
    if not payload.get("workspaceId"):
        workspaces = await firestore_db.get_workspaces_by_owner(owner_uid)
        if workspaces:
            payload["workspaceId"] = workspaces[0]["id"]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Você precisa estar em um workspace para criar um formulário.",
            )
    else:
        # Prevent creating forms in workspaces the user doesn't belong to
        await require_workspace_member(payload["workspaceId"], current_user)

    form = await firestore_db.create_form(payload)
    return form


@router.get(
    "/forms/{form_id}", response_model=FormOut, response_model_exclude_none=True
)
async def get_form(form_id: str, current_user: dict = Depends(get_current_user)):
    form = await require_form_member_access(form_id, current_user)
    return form


@router.get(
    "/forms/public/{slug}", response_model=FormOut, response_model_exclude_none=True
)
async def get_form_public(slug: str):
    form = await firestore_db.get_form_by_slug(slug)
    if not form:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Formulário público não encontrado",
        )
    return form


@router.put(
    "/forms/{form_id}", response_model=FormOut, response_model_exclude_none=True
)
async def update_form(
    form_id: str, body: FormUpdate, current_user: dict = Depends(get_current_user)
):
    await require_form_write(form_id, current_user, min_role="admin")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    form = await firestore_db.update_form(form_id, updates)
    return form


@router.delete("/forms/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_form(form_id: str, current_user: dict = Depends(get_current_user)):
    await require_form_write(form_id, current_user, min_role="admin")
    await firestore_db.delete_form(form_id)


@router.get(
    "/forms/{form_id}/submissions",
    response_model=List[SubmissionOut],
    response_model_exclude_none=True,
)
async def list_form_submissions(
    form_id: str, current_user: dict = Depends(get_current_user)
):
    await require_form_member_access(form_id, current_user)
    submissions = await firestore_db.get_submissions(form_id)
    return submissions
