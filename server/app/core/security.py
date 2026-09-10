"""
Local auth primitives — replaces `app/core/firebase.py` (Firebase Admin SDK
init + token verification). No Firebase project needed to run this app.

Password hashing uses stdlib `hashlib.scrypt` (no extra dependency).
# ponytail: scrypt with fixed cost params, not a full password-policy engine —
# upgrade to per-install tunable cost (or argon2) if this ever takes real traffic.

JWTs use `python-jose`, already a declared (if previously unused) dependency.
Claims mirror what `firebase_auth.verify_id_token()` used to return, so
`app/core/auth.py` barely changes: `uid`, `email`, `name`, `picture`, `exp`, `jti`.
"""

from __future__ import annotations

import base64
import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60
REFRESH_TOKEN_DAYS = 30

_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=32
    )
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, digest_b64 = hashed.split("$")
        if scheme != "scrypt":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected)
        )
        return secrets.compare_digest(actual, expected)
    except Exception:
        return False


def _base_claims(user: dict) -> dict:
    return {
        "uid": user["firebase_uid"],
        "email": user.get("email"),
        "name": user.get("display_name"),
        "picture": user.get("photo_url"),
    }


def create_access_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        **_base_claims(user),
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_MINUTES)).timestamp()),
        "type": "access",
    }
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "uid": user["firebase_uid"],
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=REFRESH_TOKEN_DAYS)).timestamp()),
        "type": "refresh",
    }
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Same contract as the old `firebase_auth.verify_id_token()`: returns the
    claims dict, or raises on an invalid/expired/malformed token."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as e:
        raise ValueError("Token inválido ou expirado.") from e
