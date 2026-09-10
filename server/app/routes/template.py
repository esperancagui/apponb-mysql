from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional

from app.core.auth import get_current_user
from app.core.permissions import require_template_owner
from app.services import db as firestore_db
from app.schemas.template import (
    TemplateCreate,
    TemplateUpdate,
    TemplateOut,
    TemplateGroupsUpdate,
    TemplateBrandingUpdate,
)

router = APIRouter()


def _mark_system(templates: list, is_system: bool) -> list:
    for t in templates:
        t["isSystem"] = is_system
    return templates


async def _resolve_template(template_id: str):
    """Return (template_dict, is_system). Checks system_templates first."""
    system = await firestore_db.get_system_template(template_id)
    if system:
        return system, True
    user = await firestore_db.get_template(template_id)
    if user:
        return user, False
    return None, False


@router.get("/templates", response_model=List[TemplateOut], response_model_exclude_none=True)
async def list_templates(
    category: Optional[str] = Query(None),
    workspace_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    owner_uid = current_user.get("firebase_uid")

    system, user = await _parallel_fetch(category, workspace_id, owner_uid)

    return _mark_system(system, True) + _mark_system(user, False)


async def _parallel_fetch(category, workspace_id, owner_uid):
    import asyncio
    system_coro = firestore_db.get_system_templates(category)
    user_coro = (
        firestore_db.get_templates_by_workspace(workspace_id)
        if workspace_id
        else firestore_db.get_templates_by_owner(owner_uid)
    )
    return await asyncio.gather(system_coro, user_coro)


@router.get("/templates/{template_id}", response_model=TemplateOut, response_model_exclude_none=True)
async def get_template(template_id: str, current_user: dict = Depends(get_current_user)):
    template, is_system = await require_template_owner(template_id, current_user)
    template["isSystem"] = is_system
    return template


@router.post("/templates", status_code=status.HTTP_201_CREATED, response_model=TemplateOut, response_model_exclude_none=True)
async def create_template(body: TemplateCreate, current_user: dict = Depends(get_current_user)):
    payload = body.model_dump()
    owner_uid = current_user.get("firebase_uid")
    payload["ownerId"] = owner_uid

    if not payload.get("workspaceId"):
        workspaces = await firestore_db.get_workspaces_by_owner(owner_uid)
        if workspaces:
            payload["workspaceId"] = workspaces[0]["id"]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhum workspace encontrado. Crie um workspace antes de criar templates.",
            )

    template = await firestore_db.create_template(payload)
    template["isSystem"] = False
    return template


@router.patch("/templates/{template_id}", response_model=TemplateOut, response_model_exclude_none=True)
async def update_template(template_id: str, body: TemplateUpdate, current_user: dict = Depends(get_current_user)):
    _, is_system = await require_template_owner(template_id, current_user)
    if is_system:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Templates do sistema não podem ser editados")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = await firestore_db.update_template(template_id, updates)
    updated["isSystem"] = False
    return updated


@router.patch("/templates/{template_id}/groups", response_model=TemplateOut, response_model_exclude_none=True)
async def update_template_groups(template_id: str, body: TemplateGroupsUpdate, current_user: dict = Depends(get_current_user)):
    _, is_system = await require_template_owner(template_id, current_user)
    if is_system:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Templates do sistema não podem ser editados")

    updated = await firestore_db.update_template(template_id, {"defaultGroups": [g.model_dump() for g in body.groups]})
    updated["isSystem"] = False
    return updated


@router.patch("/templates/{template_id}/branding", response_model=TemplateOut, response_model_exclude_none=True)
async def update_template_branding(template_id: str, body: TemplateBrandingUpdate, current_user: dict = Depends(get_current_user)):
    _, is_system = await require_template_owner(template_id, current_user)
    if is_system:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Templates do sistema não podem ser editados")

    updated = await firestore_db.update_template(template_id, {"defaultBranding": body.model_dump(exclude_none=True)})
    updated["isSystem"] = False
    return updated


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(template_id: str, current_user: dict = Depends(get_current_user)):
    _, is_system = await require_template_owner(template_id, current_user)
    if is_system:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Templates do sistema não podem ser removidos")

    await firestore_db.delete_template(template_id)
