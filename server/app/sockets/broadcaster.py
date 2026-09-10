from app.sockets import sio
from app.sockets.events import get_sids_for_uid


async def emit_new_submission(
    workspace_id: str,
    submission_id: str,
    form_name: str,
    client_name: str,
) -> None:
    await sio.emit(
        "inbox:new_submission",
        {
            "submissionId": submission_id,
            "workspaceId": workspace_id,
            "formName": form_name,
            "clientName": client_name,
        },
        room=f"workspace:{workspace_id}",
    )


async def emit_status_updated(
    workspace_id: str,
    submission_id: str,
    status: str,
    client_name: str = "",
    actor_name: str = "",
    actor_photo_url: str = "",
    actor_uid: str = "",
) -> None:
    await sio.emit(
        "inbox:status_updated",
        {
            "submissionId": submission_id,
            "workspaceId": workspace_id,
            "newStatus": status,
            "clientName": client_name,
            "actorName": actor_name,
            "actorPhotoUrl": actor_photo_url,
            "actorUid": actor_uid,
        },
        room=f"workspace:{workspace_id}",
    )


async def emit_insight_completed(
    workspace_id: str,
    submission_id: str,
    insight_id: str,
    ai_risk: str = "low",
    client_name: str = "",
) -> None:
    await sio.emit(
        "insight:completed",
        {
            "submissionId": submission_id,
            "workspaceId": workspace_id,
            "insightId": insight_id,
            "aiRisk": ai_risk,
            "clientName": client_name,
        },
        room=f"workspace:{workspace_id}",
    )


async def join_workspace_room(firebase_uid: str, workspace_id: str) -> None:
    """Add all active sockets of *firebase_uid* to the workspace room immediately.

    Called whenever a user is added to a workspace so they start receiving
    workspace events without needing to reconnect.
    """
    for sid in get_sids_for_uid(firebase_uid):
        await sio.enter_room(sid, f"workspace:{workspace_id}")


async def emit_invite_received(
    invited_uid: str,
    invite_data: dict,
) -> None:
    """Emit a workspace invite notification to a specific user's personal room."""
    await sio.emit(
        "workspace:invite_received",
        invite_data,
        room=f"user:{invited_uid}",
    )


async def emit_member_joined(
    admin_uids: list[str],
    payload: dict,
) -> None:
    """Notify workspace owners and admins when a new member joins."""
    for uid in admin_uids:
        await sio.emit("workspace:member_joined", payload, room=f"user:{uid}")
