from fastapi import APIRouter, Depends, status, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from firebase_admin import auth as firebase_auth_admin

from app.core.auth import get_current_user
from app.core.permissions import require_workspace_owner, require_workspace_member
from app.core.plan_limits import check_workspace_limit, check_member_limit
from app.services import firestore_db
from app.sockets import broadcaster

router = APIRouter()

VALID_ROLES = {"admin", "member", "viewer"}


class WorkspaceCreate(BaseModel):
    name: str
    slug: str
    plan: Optional[str] = "free"
    brandColor: Optional[str] = None


class MemberInvite(BaseModel):
    email: str
    role: str = "member"


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    logoUrl: Optional[str] = None
    brandColor: Optional[str] = None


class MemberRoleUpdate(BaseModel):
    role: str


@router.get("/workspaces")
async def list_workspaces(current_user: dict = Depends(get_current_user)):
    uid = current_user.get("firebase_uid")
    try:
        workspaces = await firestore_db.get_workspaces_for_user(uid)
        return workspaces
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workspaces/{workspace_id}")
async def get_workspace(
    workspace_id: str, current_user: dict = Depends(get_current_user)
):
    ws = await require_workspace_member(workspace_id, current_user)
    return ws


@router.post("/workspaces", status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: WorkspaceCreate, current_user: dict = Depends(get_current_user)
):
    uid = current_user.get("firebase_uid")
    await check_workspace_limit(uid)

    payload = body.model_dump()
    payload["ownerId"] = uid
    try:
        ws = await firestore_db.create_workspace(payload)
        return ws
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/workspaces/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    body: WorkspaceUpdate,
    current_user: dict = Depends(get_current_user),
):
    await require_workspace_owner(workspace_id, current_user)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    try:
        ws = await firestore_db.update_workspace(workspace_id, updates)
        return ws
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workspaces/{workspace_id}/members")
async def list_members(
    workspace_id: str, current_user: dict = Depends(get_current_user)
):
    await require_workspace_owner(workspace_id, current_user)
    try:
        members = await firestore_db.get_workspace_members(workspace_id)
        return members
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workspaces/{workspace_id}/members", status_code=status.HTTP_201_CREATED)
async def invite_member(
    workspace_id: str,
    body: MemberInvite,
    current_user: dict = Depends(get_current_user),
):
    await require_workspace_owner(workspace_id, current_user)
    await check_member_limit(workspace_id)
    if body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=400, detail=f"Papel inválido. Use: {', '.join(VALID_ROLES)}"
        )
    try:
        fb_user = firebase_auth_admin.get_user_by_email(body.email)
    except firebase_auth_admin.UserNotFoundError:
        raise HTTPException(
            status_code=404, detail="Usuário não encontrado com este email"
        )
    existing_members = await firestore_db.get_workspace_members(workspace_id)
    if any(m["uid"] == fb_user.uid for m in existing_members):
        raise HTTPException(
            status_code=409, detail="Este usuário já é membro do workspace"
        )
    await firestore_db.add_workspace_member(workspace_id, fb_user.uid, body.role)
    try:
        await broadcaster.join_workspace_room(fb_user.uid, workspace_id)
    except Exception:
        pass
    return {"uid": fb_user.uid, "email": fb_user.email, "role": body.role}


@router.patch("/workspaces/{workspace_id}/members/{uid}")
async def update_member_role(
    workspace_id: str,
    uid: str,
    body: MemberRoleUpdate,
    current_user: dict = Depends(get_current_user),
):
    ws = await require_workspace_owner(workspace_id, current_user)
    if uid == ws.get("ownerId"):
        raise HTTPException(
            status_code=400, detail="Não é possível alterar o papel do proprietário"
        )
    if body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=400, detail=f"Papel inválido. Use: {', '.join(VALID_ROLES)}"
        )
    await firestore_db.update_workspace_member_role(workspace_id, uid, body.role)
    return {"uid": uid, "role": body.role}


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
):
    await require_workspace_owner(workspace_id, current_user)
    try:
        await firestore_db.delete_workspace(workspace_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/workspaces/{workspace_id}/members/{uid}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_member(
    workspace_id: str,
    uid: str,
    current_user: dict = Depends(get_current_user),
):
    ws = await require_workspace_owner(workspace_id, current_user)
    if uid == ws.get("ownerId"):
        raise HTTPException(
            status_code=400, detail="Não é possível remover o proprietário do workspace"
        )
    await firestore_db.remove_workspace_member(workspace_id, uid)


@router.get("/workspaces/{workspace_id}/pendencies")
async def get_workspace_pendencies(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retorna pendências do workspace (ex: convites pendentes, formulários sem resposta)."""
    await require_workspace_owner(workspace_id, current_user)
    # Por enquanto retorna vazio, similar ao mock
    return []
