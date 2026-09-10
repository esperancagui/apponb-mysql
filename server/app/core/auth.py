from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.firebase import firebase_auth
from app.services.auth_service import get_user_by_firebase_uid, is_token_blacklisted

http_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
) -> dict:
    """
    FastAPI dependency that verifies a Firebase ID Token from the Authorization header.

    Raises 401 if the token is invalid, expired, or blacklisted.
    Returns the user dict from Firestore (with UUID as 'id').
    """
    token = credentials.credentials

    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
        )

    jti: str = decoded.get("jti", "")
    if jti and is_token_blacklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token revogado. Faça login novamente.",
        )

    firebase_uid: str = decoded.get("uid") or decoded.get("user_id", "")
    user = get_user_by_firebase_uid(firebase_uid)
    if user is not None and not user.get("photo_url") and decoded.get("picture"):
        # Enrich with photo from Firebase token (e.g. Google sign-in) without a DB write
        user = {**user, "photo_url": decoded["picture"]}
    if user is None:
        # Token is valid but Firestore user doc doesn't exist yet.
        # This happens during the registration race condition (onAuthStateChanged fires
        # before ensureBackendUser completes). Auto-create from the token claims.
        try:
            from app.services.auth_service import (
                create_user,
                check_fingerprint_used,
                check_email_previously_used,
            )
            from app.core.disposable_domains import validate_email_domain

            email = decoded.get("email", "").lower().strip()
            display_name = decoded.get("name")

            # Apply same abuse checks as /register to prevent bypass via race condition
            if not email:
                raise ValueError("E-mail não encontrado no token.")

            email_error = validate_email_domain(email)
            if email_error:
                raise ValueError(email_error)

            if check_email_previously_used(email):
                raise ValueError("Este e-mail já utilizou o período de teste gratuito.")

            user = create_user(
                firebase_uid=firebase_uid,
                email=email,
                display_name=display_name,
            )
        except ValueError as ve:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(ve),
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário não encontrado.",
            )

    return user
