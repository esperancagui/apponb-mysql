import csv
import io
import json
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
from app.schemas.auth import (
    RegisterRequest,
    ReactivateRequest,
    UserResponse,
    UpdateProfileRequest,
    UpdatePreferencesRequest,
    PreferencesResponse,
)
from app.services.auth_service import (
    create_user,
    get_user_by_firebase_uid,
    check_fingerprint_used,
    check_email_previously_used,
    blacklist_token,
    update_user_profile,
    update_user_preferences,
    pause_account,
    reactivate_account,
    delete_account,
)
from app.services import firestore_db
from app.services.email_service import send_data_export_email
from app.core.auth import get_current_user
from app.core.firebase import firebase_auth
from app.core.disposable_domains import validate_email_domain

router = APIRouter()
http_bearer = HTTPBearer()


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
def register_user(
    body: RegisterRequest,
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
):
    """
    Called by the client after Firebase registration.
    Creates the Firestore user document with a UUID.
    """
    # ── Token Verification ─────────────────────────────────────────
    token = credentials.credentials
    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido."
        )

    if decoded.get("uid") != body.firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="UID mismatch."
        )

    email = body.email.lower().strip()

    existing = get_user_by_firebase_uid(body.firebase_uid)
    if existing:
        return UserResponse(
            id=existing["id"],
            email=existing["email"],
            display_name=existing.get("display_name"),
            photo_url=existing.get("photo_url"),
            firebase_uid=existing["firebase_uid"],
            created_at=existing["created_at"],
            plan=existing.get("plan", "free"),
            subscription_status=existing.get("subscription_status"),
            current_period_end=existing.get("current_period_end"),
            trial_end=existing.get("trial_end"),
        )

    # ── Trial abuse checks ─────────────────────────────────────────
    # 1. Validate email domain (disposable blocklist + DNS MX check)
    email_error = validate_email_domain(email)
    if email_error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=email_error,
        )

    # 2. Block emails previously used by deleted accounts
    if check_email_previously_used(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este e-mail já utilizou o período de teste gratuito.",
        )

    # 3. Block reused browser fingerprints (same device, new account)
    if body.fingerprint and check_fingerprint_used(body.fingerprint):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este dispositivo já utilizou o período de teste gratuito.",
        )

    user = create_user(
        firebase_uid=body.firebase_uid,
        email=email,
        display_name=body.display_name,
        fingerprint=body.fingerprint,
    )
    return UserResponse(
        id=user["id"],
        email=user["email"],
        display_name=user.get("display_name"),
        photo_url=user.get("photo_url"),
        firebase_uid=user["firebase_uid"],
        created_at=user["created_at"],
        plan=user.get("plan", "free"),
        subscription_status=user.get("subscription_status"),
        current_period_end=user.get("current_period_end"),
        trial_end=user.get("trial_end"),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    current_user: dict = Depends(get_current_user),
):
    """
    Blacklists the current token's JTI so it cannot be reused after logout.
    """
    token = credentials.credentials
    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido."
        )

    jti: str = decoded.get("jti", "")
    exp: int = decoded.get("exp", 0)
    if jti:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
        blacklist_token(jti, expires_at)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        display_name=current_user.get("display_name"),
        photo_url=current_user.get("photo_url"),
        firebase_uid=current_user["firebase_uid"],
        created_at=current_user["created_at"],
        plan=current_user.get("plan", "free"),
        subscription_status=current_user.get("subscription_status"),
        current_period_end=current_user.get("current_period_end"),
        trial_end=current_user.get("trial_end"),
    )


@router.patch("/profile", response_model=UserResponse)
def update_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    """Updates display_name and/or photo_url for the authenticated user."""
    if body.display_name is None and body.photo_url is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nenhum campo fornecido para atualização.",
        )

    updated = update_user_profile(
        firebase_uid=current_user["firebase_uid"],
        display_name=body.display_name,
        photo_url=body.photo_url,
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado."
        )

    return UserResponse(
        id=updated["id"],
        email=updated["email"],
        display_name=updated.get("display_name"),
        photo_url=updated.get("photo_url"),
        firebase_uid=updated["firebase_uid"],
        created_at=updated["created_at"],
        plan=updated.get("plan", "free"),
        subscription_status=updated.get("subscription_status"),
        current_period_end=updated.get("current_period_end"),
        trial_end=updated.get("trial_end"),
    )


@router.patch("/preferences", response_model=PreferencesResponse)
def update_preferences(
    body: UpdatePreferencesRequest,
    current_user: dict = Depends(get_current_user),
):
    """Updates notification and language preferences for the authenticated user."""
    if body.email_notifications is None and body.language is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nenhum campo fornecido para atualização.",
        )

    prefs = update_user_preferences(
        firebase_uid=current_user["firebase_uid"],
        email_notifications=body.email_notifications,
        language=body.language,
    )
    return PreferencesResponse(**prefs)


@router.post("/pause", status_code=status.HTTP_204_NO_CONTENT)
def pause_user_account(current_user: dict = Depends(get_current_user)):
    """Disables the authenticated user's Firebase account."""
    try:
        pause_account(current_user["firebase_uid"])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao pausar conta. Tente novamente.",
        )


@router.post("/reactivate", status_code=status.HTTP_204_NO_CONTENT)
def reactivate_user_account(body: ReactivateRequest):
    """Re-enables a paused (disabled) Firebase account. Public endpoint — no auth required."""
    try:
        reactivate_account(body.email)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email não encontrado.",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao reativar conta. Tente novamente.",
        )


def _build_submissions_csv(submissions: list) -> bytes:
    """Converte a lista de submissões para CSV tabular (UTF-8 com BOM para Excel)."""
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)
    writer.writerow([
        "id", "formulario_id", "formulario_nome", "workspace_id",
        "status", "submetido_em", "respostas_json",
    ])
    for sub in submissions:
        writer.writerow([
            sub.get("id", ""),
            sub.get("form_id", ""),
            sub.get("form_name", ""),
            sub.get("workspace_id", ""),
            sub.get("status", ""),
            sub.get("submitted_at", ""),
            json.dumps(sub.get("answers", []), ensure_ascii=False),
        ])
    return ("\ufeff" + output.getvalue()).encode("utf-8")


async def _run_data_export(firebase_uid: str, email: str, display_name: str) -> None:
    """Background task: coleta dados, gera JSON + CSV e envia por e-mail."""
    data = await firestore_db.export_user_data(firebase_uid)
    if not data:
        return

    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    json_bytes = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    csv_bytes = _build_submissions_csv(data.get("submissions", []))

    send_data_export_email(
        to_email=email,
        display_name=display_name,
        json_bytes=json_bytes,
        csv_bytes=csv_bytes,
        date_str=date_str,
    )


@router.post("/request-export", status_code=status.HTTP_202_ACCEPTED)
async def request_data_export(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    LGPD Art. 18, V — Portabilidade de dados.
    Dispara uma exportação assíncrona: o usuário recebe JSON + CSV por e-mail.
    """
    background_tasks.add_task(
        _run_data_export,
        firebase_uid=current_user["firebase_uid"],
        email=current_user["email"],
        display_name=current_user.get("display_name") or "",
    )
    return {"message": "Exportação solicitada. Você receberá um e-mail em breve."}


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_account(current_user: dict = Depends(get_current_user)):
    """Permanently deletes the authenticated user's account."""
    try:
        delete_account(current_user["firebase_uid"])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao excluir conta. Tente novamente.",
        )
