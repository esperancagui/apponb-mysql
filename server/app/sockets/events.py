import logging
from collections import defaultdict

from app.sockets import sio
from app.core.firebase import firebase_auth
from app.services import firestore_db

logger = logging.getLogger(__name__)

# uid → set of active socket IDs (enables dynamic room joins when membership changes)
_uid_sids: dict[str, set[str]] = defaultdict(set)


def get_sids_for_uid(uid: str) -> set[str]:
    """Return currently connected socket IDs for a Firebase UID."""
    return set(_uid_sids.get(uid, set()))


def register_handlers() -> None:
    """Register all Socket.IO event handlers on the sio instance."""

    @sio.event
    async def connect(sid, environ, auth):
        token = (auth or {}).get("token")
        if not token:
            logger.warning("Socket rejected — no token (sid=%s)", sid)
            return False
        try:
            decoded = firebase_auth.verify_id_token(token)
            uid = decoded["uid"]
        except Exception as e:
            logger.warning("Socket auth failed (sid=%s): %s", sid, e)
            return False

        # Track sid → uid mapping for dynamic room management
        _uid_sids[uid].add(sid)
        await sio.save_session(sid, {"uid": uid})

        # Personal room — for direct notifications (invites, etc.)
        await sio.enter_room(sid, f"user:{uid}")

        workspaces = await firestore_db.get_workspaces_for_user(uid)
        for ws in workspaces:
            ws_id = ws.get("id")
            if ws_id:
                await sio.enter_room(sid, f"workspace:{ws_id}")

        logger.info(
            "Socket connected: sid=%s uid=%s joined %d workspace rooms + personal room",
            sid,
            uid,
            len(workspaces),
        )

    @sio.event
    async def disconnect(sid):
        session = await sio.get_session(sid)
        uid = (session or {}).get("uid")
        if uid and uid in _uid_sids:
            _uid_sids[uid].discard(sid)
            if not _uid_sids[uid]:
                del _uid_sids[uid]
        logger.info("Socket disconnected: sid=%s", sid)
