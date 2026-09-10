from fastapi import APIRouter, Depends, status, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone

from app.core.auth import get_current_user
from app.core.permissions import require_workspace_owner
from app.core.plan_limits import check_member_limit
from app.core.firebase import firebase_auth
from app.services import firestore_db
from app.services import email_service
from app.services import auth_service
from app.sockets import broadcaster
import asyncio
import os

router = APIRouter()

VALID_ROLES = {"admin", "member", "viewer"}
VALID_DURATIONS = {"1h": 1, "24h": 24, "7d": 168, "30d": 720}  # hours


def _is_expired(invite: dict) -> bool:
    expires_at_str = invite.get("expiresAt")
    if not expires_at_str:
        return False
    try:
        expires_at = datetime.fromisoformat(expires_at_str)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) > expires_at
    except (ValueError, TypeError):
        return False


class InviteCreate(BaseModel):
    role: str = "member"
    expiresIn: str = "7d"
    maxUses: int = 0
    email: str = ""  # if provided, creates a targeted invite for this user


# ── Create invite ──────────────────────────────────────────────────────────────


@router.post("/workspaces/{workspace_id}/invites", status_code=status.HTTP_201_CREATED)
async def create_invite(
    workspace_id: str,
    body: InviteCreate,
    current_user: dict = Depends(get_current_user),
):
    await require_workspace_owner(workspace_id, current_user)
    await check_member_limit(workspace_id)

    if body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Papel inválido. Use: {', '.join(VALID_ROLES)}",
        )

    hours = VALID_DURATIONS.get(body.expiresIn)
    if hours is None:
        raise HTTPException(
            status_code=400,
            detail=f"Duração inválida. Use: {', '.join(VALID_DURATIONS.keys())}",
        )

    expires_at = datetime.now(timezone.utc) + timedelta(hours=hours)

    invite_data = {
        "workspaceId": workspace_id,
        "role": body.role,
        "createdBy": current_user.get("firebase_uid"),
        "expiresAt": expires_at.isoformat(),
        "maxUses": body.maxUses,
    }

    # Resolve email to UID for targeted invite
    invited_uid: Optional[str] = None
    if body.email:
        try:
            invited_user = firebase_auth.get_user_by_email(body.email)
            invited_uid = invited_user.uid
            invite_data["invitedUid"] = invited_uid
        except Exception:
            pass  # Email not found — still create invite, will notify via email only

    invite = await firestore_db.create_workspace_invite(invite_data)

    # Enrich workspace info once (reused below)
    ws = await firestore_db.get_workspace(workspace_id)
    ws_name = ws.get("name", "Workspace") if ws else "Workspace"
    brand_color = ws.get("brandColor", "#6366f1") if ws else "#6366f1"
    inviter_name = current_user.get("display_name") or current_user.get("name") or ""

    # Send in-app socket notification to invited user (if online)
    if invited_uid:
        try:
            await broadcaster.emit_invite_received(
                invited_uid,
                {
                    "inviteCode": invite["code"],
                    "workspaceId": workspace_id,
                    "workspaceName": ws_name,
                    "workspaceLogo": ws.get("logoUrl") if ws else None,
                    "brandColor": brand_color,
                    "inviterName": inviter_name,
                    "inviterPhotoUrl": current_user.get("photo_url") or "",
                    "role": body.role,
                },
            )
        except Exception:
            pass

    # Send email notification via Resend
    if body.email:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        invite_url = f"{frontend_url}/invite/{invite['code']}"
        email_service.send_invite_email(
            to_email=body.email,
            workspace_name=ws_name,
            invite_url=invite_url,
            role=body.role,
            inviter_name=inviter_name,
            brand_color=brand_color,
        )

    return invite


# ── List active invites for a workspace ───────────────────────────────────────


@router.get("/workspaces/{workspace_id}/invites")
async def list_invites(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
):
    await require_workspace_owner(workspace_id, current_user)
    invites = await firestore_db.get_workspace_invites(workspace_id)

    active = []
    for inv in invites:
        if _is_expired(inv):
            await firestore_db.delete_invite(inv["id"])
        else:
            active.append(inv)
    return active


# ── Pending invites for current user ──────────────────────────────────────────


@router.get("/invites/pending")
async def get_pending_invites(
    current_user: dict = Depends(get_current_user),
):
    """Returns targeted invites directed at the current user."""
    uid = current_user.get("firebase_uid")
    invites = await firestore_db.get_pending_invites_for_user(uid)

    result = []
    for inv in invites:
        if _is_expired(inv):
            await firestore_db.delete_invite(inv["id"])
            continue
        ws = await firestore_db.get_workspace(inv["workspaceId"])
        # Look up inviter photo (sync call in thread to stay non-blocking)
        inviter_photo = ""
        inviter_name = ""
        created_by = inv.get("createdBy")
        if created_by:
            try:
                inviter = await asyncio.to_thread(auth_service.get_user_by_firebase_uid, created_by)
                if inviter:
                    inviter_photo = inviter.get("photo_url") or ""
                    inviter_name = inviter.get("display_name") or ""
            except Exception:
                pass
        result.append({
            **inv,
            "workspaceName": ws.get("name", "Workspace") if ws else "Workspace",
            "workspaceLogo": ws.get("logoUrl") if ws else None,
            "brandColor": ws.get("brandColor") if ws else None,
            "inviterName": inviter_name or inv.get("inviterName", ""),
            "inviterPhotoUrl": inviter_photo,
        })
    return result


# ── Get invite info (public) ───────────────────────────────────────────────────


@router.get("/invites/{code}")
async def get_invite(code: str):
    invite = await firestore_db.get_invite_by_code(code)
    if not invite:
        raise HTTPException(status_code=404, detail="Convite não encontrado ou expirado")

    if _is_expired(invite):
        await firestore_db.delete_invite(invite["id"])
        raise HTTPException(status_code=410, detail="Este convite expirou")

    max_uses = invite.get("maxUses", 0)
    use_count = invite.get("useCount", 0)
    if max_uses > 0 and use_count >= max_uses:
        raise HTTPException(status_code=410, detail="Este convite atingiu o limite de usos")

    ws = await firestore_db.get_workspace(invite["workspaceId"])
    ws_name = ws.get("name", "Workspace") if ws else "Workspace"

    return {
        "code": invite["code"],
        "role": invite["role"],
        "workspaceName": ws_name,
        "workspaceLogoUrl": ws.get("logoUrl") if ws else None,
        "workspaceBrandColor": ws.get("brandColor") if ws else None,
        "expiresAt": invite.get("expiresAt"),
    }


# ── Accept invite ──────────────────────────────────────────────────────────────


@router.post("/invites/{code}/accept")
async def accept_invite(
    code: str,
    current_user: dict = Depends(get_current_user),
):
    invite = await firestore_db.get_invite_by_code(code)
    if not invite:
        raise HTTPException(status_code=404, detail="Convite não encontrado ou expirado")

    if _is_expired(invite):
        await firestore_db.delete_invite(invite["id"])
        raise HTTPException(status_code=410, detail="Este convite expirou")

    max_uses = invite.get("maxUses", 0)
    use_count = invite.get("useCount", 0)
    if max_uses > 0 and use_count >= max_uses:
        raise HTTPException(status_code=410, detail="Este convite atingiu o limite de usos")

    uid = current_user.get("firebase_uid")
    workspace_id = invite["workspaceId"]

    existing_members = await firestore_db.get_workspace_members(workspace_id)
    if any(m["uid"] == uid for m in existing_members):
        raise HTTPException(status_code=409, detail="Você já é membro deste workspace")

    await check_member_limit(workspace_id)

    await firestore_db.add_workspace_member(workspace_id, uid, invite["role"])
    await firestore_db.increment_invite_use(invite["id"])

    # Immediately join the new member's active sockets to the workspace room
    try:
        await broadcaster.join_workspace_room(uid, workspace_id)
    except Exception:
        pass

    # Deactivate targeted invite after use (so it won't appear as pending again)
    if invite.get("invitedUid"):
        await firestore_db.revoke_invite(invite["id"])

    # Notify workspace owners and admins
    try:
        all_members = await firestore_db.get_workspace_members(workspace_id)
        admin_uids = [
            m["uid"] for m in all_members
            if m.get("role") in ("owner", "admin") and m["uid"] != uid
        ]
        if admin_uids:
            member_name = current_user.get("display_name") or current_user.get("name") or ""
            ws = await firestore_db.get_workspace(workspace_id)
            ws_name = ws.get("name", "Workspace") if ws else "Workspace"
            await broadcaster.emit_member_joined(
                admin_uids,
                {
                    "workspaceId": workspace_id,
                    "workspaceName": ws_name,
                    "memberName": member_name,
                    "memberEmail": current_user.get("email", ""),
                    "memberPhotoUrl": current_user.get("photo_url") or "",
                    "role": invite["role"],
                },
            )
    except Exception:
        pass

    return {"workspaceId": workspace_id, "role": invite["role"]}


# ── Decline invite ─────────────────────────────────────────────────────────────


@router.post("/invites/{code}/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline_invite(
    code: str,
    current_user: dict = Depends(get_current_user),
):
    invite = await firestore_db.get_invite_by_code(code)
    if not invite:
        raise HTTPException(status_code=404, detail="Convite não encontrado")

    # Only the invited user can decline a targeted invite
    uid = current_user.get("firebase_uid")
    invited_uid = invite.get("invitedUid")
    if invited_uid and invited_uid != uid:
        raise HTTPException(status_code=403, detail="Sem permissão para recusar este convite")

    await firestore_db.revoke_invite(invite["id"])


# ── Revoke invite (owner) ──────────────────────────────────────────────────────


@router.delete(
    "/workspaces/{workspace_id}/invites/{invite_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_invite(
    workspace_id: str,
    invite_id: str,
    current_user: dict = Depends(get_current_user),
):
    await require_workspace_owner(workspace_id, current_user)
    await firestore_db.delete_invite(invite_id)
