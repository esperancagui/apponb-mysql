from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security import decode_token
from app.services.auth_service import get_user_by_firebase_uid, is_token_blacklisted

http_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
) -> dict:
    """
    FastAPI dependency that verifies a locally-issued JWT access token.

    Raises 401 if the token is invalid, expired, or blacklisted (logged out).
    Returns the user dict from MySQL (with UUID `id`, and `firebase_uid` — the
    name kept from the Firebase days, now just a locally-generated opaque id).
    """
    token = credentials.credentials

    try:
        decoded = decode_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
        )

    jti: str = decoded.get("jti", "")
    if jti and await is_token_blacklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token revogado. Faça login novamente.",
        )

    firebase_uid: str = decoded.get("uid", "")
    user = await get_user_by_firebase_uid(firebase_uid)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
        )

    return user
