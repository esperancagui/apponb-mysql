"""
User lifecycle: create, profile updates, pause/reactivate/delete, trial-abuse
checks, and the token blacklist. Was sync + Firebase Admin; now async + MySQL
(async because `get_current_user` awaits it on every authenticated request —
the old version blocked the event loop here twice per request).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.core.security import hash_password, verify_password
from app.db.pool import execute, fetch_one

TRIAL_DAYS = 15


async def create_user(
    email: str,
    password: str,
    display_name: Optional[str] = None,
    fingerprint: Optional[str] = None,
) -> dict:
    """Create a user with a UUID as both the primary key and (kept for
    compatibility with every other table's FK) the `firebase_uid` value.

    New users automatically receive a free trial (no card required).
    """
    user_id = str(uuid.uuid4())
    firebase_uid = uuid.uuid4().hex  # opaque id, same role the Firebase UID used to play
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    trial_end = now + timedelta(days=TRIAL_DAYS)
    clean_email = email.lower().strip()

    user = {
        "id": user_id,
        "firebase_uid": firebase_uid,
        "email": clean_email,
        "display_name": display_name,
        "photo_url": None,
        "created_at": now,
        "plan": "free",
        "subscription_status": "trialing",
        "trial_end": trial_end,
        "current_period_end": None,
    }
    await execute(
        """INSERT INTO users
           (id, firebase_uid, email, password_hash, display_name, created_at,
            plan, subscription_status, trial_end)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (user_id, firebase_uid, clean_email, hash_password(password), display_name,
         now, "free", "trialing", trial_end),
    )

    if fingerprint:
        await store_trial_fingerprint(fingerprint, firebase_uid)

    return user


async def authenticate(email: str, password: str) -> Optional[dict]:
    """Verify email/password. Returns the user row on success, None otherwise."""
    user = await fetch_one(
        "SELECT * FROM users WHERE email=%s AND deleted=0 LIMIT 1", (email.lower().strip(),)
    )
    if not user or not user.get("password_hash"):
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    if user.get("disabled"):
        raise PermissionError("account-disabled")
    return user


async def check_fingerprint_used(fingerprint: str) -> bool:
    if not fingerprint:
        return False
    row = await fetch_one(
        "SELECT id FROM trial_fingerprints WHERE fingerprint=%s LIMIT 1", (fingerprint,)
    )
    return row is not None


async def store_trial_fingerprint(fingerprint: str, firebase_uid: str) -> None:
    if not fingerprint:
        return
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    await execute(
        "INSERT INTO trial_fingerprints (id, fingerprint, firebase_uid, created_at) VALUES (%s,%s,%s,%s)",
        (str(uuid.uuid4()), fingerprint, firebase_uid, now),
    )


async def get_user_by_firebase_uid(firebase_uid: str) -> Optional[dict]:
    return await fetch_one("SELECT * FROM users WHERE firebase_uid=%s LIMIT 1", (firebase_uid,))


async def blacklist_token(jti: str, expires_at: datetime) -> None:
    await execute(
        "INSERT INTO token_blacklist (jti, expires_at) VALUES (%s,%s) "
        "ON DUPLICATE KEY UPDATE expires_at=VALUES(expires_at)",
        (jti, expires_at),
    )


async def is_token_blacklisted(jti: str) -> bool:
    row = await fetch_one("SELECT jti FROM token_blacklist WHERE jti=%s", (jti,))
    return row is not None


async def cleanup_expired_tokens() -> int:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    return await execute("DELETE FROM token_blacklist WHERE expires_at < %s", (now,))


async def update_user_profile(
    firebase_uid: str,
    display_name: Optional[str],
    photo_url: Optional[str],
) -> Optional[dict]:
    updates = {}
    if display_name is not None:
        updates["display_name"] = display_name
    if photo_url is not None:
        updates["photo_url"] = photo_url
    if updates:
        cols = ", ".join(f"{k}=%s" for k in updates)
        await execute(
            f"UPDATE users SET {cols} WHERE firebase_uid=%s",
            (*updates.values(), firebase_uid),
        )
    return await get_user_by_firebase_uid(firebase_uid)


async def update_user_preferences(
    firebase_uid: str,
    email_notifications: Optional[bool],
    language: Optional[str],
) -> dict:
    updates = {}
    if email_notifications is not None:
        updates["email_notifications"] = email_notifications
    if language is not None:
        updates["language"] = language
    if updates:
        cols = ", ".join(f"{k}=%s" for k in updates)
        await execute(
            f"UPDATE users SET {cols} WHERE firebase_uid=%s",
            (*updates.values(), firebase_uid),
        )
    user = await get_user_by_firebase_uid(firebase_uid)
    if not user:
        return {"email_notifications": True, "language": "pt-BR"}
    return {
        "email_notifications": bool(user.get("email_notifications", True)),
        "language": user.get("language", "pt-BR"),
    }


async def change_password(firebase_uid: str, current_password: str, new_password: str) -> None:
    user = await get_user_by_firebase_uid(firebase_uid)
    if not user or not user.get("password_hash"):
        raise ValueError("Usuário não encontrado.")
    if not verify_password(current_password, user["password_hash"]):
        raise ValueError("Senha atual incorreta.")
    await execute(
        "UPDATE users SET password_hash=%s WHERE firebase_uid=%s",
        (hash_password(new_password), firebase_uid),
    )


async def pause_account(firebase_uid: str) -> None:
    await execute("UPDATE users SET disabled=1 WHERE firebase_uid=%s", (firebase_uid,))


async def reactivate_account(email: str) -> None:
    """Re-enables a disabled account by email. Raises ValueError if not found."""
    user = await fetch_one(
        "SELECT firebase_uid FROM users WHERE email=%s AND deleted=0 LIMIT 1",
        (email.lower().strip(),),
    )
    if not user:
        raise ValueError("Email não encontrado.")
    await execute(
        "UPDATE users SET disabled=0 WHERE firebase_uid=%s", (user["firebase_uid"],)
    )


async def delete_account(firebase_uid: str) -> None:
    """Soft-delete: keep the row (email retained for trial-abuse detection),
    scrub personal data, and obfuscate firebase_uid so it can't be reused."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    await execute(
        """UPDATE users
           SET deleted=1, deleted_at=%s, display_name=NULL, photo_url=NULL,
               password_hash=NULL, firebase_uid=%s
           WHERE firebase_uid=%s""",
        (now, f"deleted_{firebase_uid}", firebase_uid),
    )


async def check_email_previously_used(email: str) -> bool:
    clean_email = email.lower().strip()
    row = await fetch_one(
        "SELECT id FROM users WHERE email=%s AND deleted=1 LIMIT 1", (clean_email,)
    )
    return row is not None


# ── Password reset ───────────────────────────────────────────────────────────

RESET_TOKEN_HOURS = 2


async def create_password_reset(email: str) -> Optional[tuple[str, dict]]:
    """Returns (token, user) if the email exists, None otherwise (caller should
    respond the same way either way, to avoid leaking which emails are registered)."""
    import secrets

    user = await fetch_one(
        "SELECT * FROM users WHERE email=%s AND deleted=0 LIMIT 1", (email.lower().strip(),)
    )
    if not user:
        return None
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    expires_at = now + timedelta(hours=RESET_TOKEN_HOURS)
    await execute(
        "INSERT INTO password_resets (token, user_id, expires_at, created_at) VALUES (%s,%s,%s,%s)",
        (token, user["id"], expires_at, now),
    )
    return token, user


async def consume_password_reset(token: str, new_password: str) -> None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    reset = await fetch_one(
        "SELECT * FROM password_resets WHERE token=%s AND used_at IS NULL AND expires_at > %s",
        (token, now),
    )
    if not reset:
        raise ValueError("Link de redefinição inválido ou expirado.")
    await execute(
        "UPDATE users SET password_hash=%s WHERE id=%s",
        (hash_password(new_password), reset["user_id"]),
    )
    await execute("UPDATE password_resets SET used_at=%s WHERE token=%s", (now, token))
