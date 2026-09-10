import csv
import io
import json
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    ReactivateRequest,
    UserResponse,
    UpdateProfileRequest,
    UpdatePreferencesRequest,
    PreferencesResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.services.auth_service import (
    create_user,
    authenticate,
    get_user_by_firebase_uid,
    check_fingerprint_used,
    check_email_previously_used,
    blacklist_token,
    update_user_profile,
    update_user_preferences,
    change_password,
    pause_account,
    reactivate_account,
    delete_account,
    create_password_reset,
    consume_password_reset,
)
from app.services import db
from app.services.email_service import send_data_export_email, send_password_reset_email
from app.core.auth import get_current_user
from app.core.security import decode_token, create_access_token, create_refresh_token
from app.core.disposable_domains import validate_email_domain
import os

router = APIRouter()
http_bearer = HTTPBearer()


def _user_response(user: dict) -> UserResponse:
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


def _token_response(user: dict) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
        user=_user_response(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_user(body: RegisterRequest):
    """Creates the account and returns a token pair — a single call, unlike the
    old two-step Firebase-then-backend flow."""
    email = body.email.lower().strip()

    if len(body.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A senha deve ter no mínimo 8 caracteres.",
        )

    existing = await db.get_user_by_email(email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está cadastrado.",
        )

    email_error = validate_email_domain(email)
    if email_error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=email_error)

    if await check_email_previously_used(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este e-mail já utilizou o período de teste gratuito.",
        )

    if body.fingerprint and await check_fingerprint_used(body.fingerprint):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este dispositivo já utilizou o período de teste gratuito.",
        )

    user = await create_user(
        email=email,
        password=body.password,
        display_name=body.display_name,
        fingerprint=body.fingerprint,
    )
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    try:
        user = await authenticate(body.email, body.password)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="account-disabled")

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos."
        )
    return _token_response(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    try:
        decoded = decode_token(body.refresh_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido.")

    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")

    user = await get_user_by_firebase_uid(decoded.get("uid", ""))
    if not user or user.get("disabled"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado.")
    return _token_response(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    current_user: dict = Depends(get_current_user),
):
    """Blacklists the current token's JTI so it can't be reused after logout."""
    try:
        decoded = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")

    jti: str = decoded.get("jti", "")
    exp: int = decoded.get("exp", 0)
    if jti:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc).replace(tzinfo=None)
        await blacklist_token(jti, expires_at)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return _user_response(current_user)


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    if body.display_name is None and body.photo_url is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nenhum campo fornecido para atualização.",
        )
    updated = await update_user_profile(
        firebase_uid=current_user["firebase_uid"],
        display_name=body.display_name,
        photo_url=body.photo_url,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    return _user_response(updated)


@router.patch("/preferences", response_model=PreferencesResponse)
async def update_preferences(
    body: UpdatePreferencesRequest,
    current_user: dict = Depends(get_current_user),
):
    if body.email_notifications is None and body.language is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nenhum campo fornecido para atualização.",
        )
    prefs = await update_user_preferences(
        firebase_uid=current_user["firebase_uid"],
        email_notifications=body.email_notifications,
        language=body.language,
    )
    return PreferencesResponse(**prefs)


@router.patch("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password_route(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        await change_password(current_user["firebase_uid"], body.current_password, body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(body: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    """Always responds 202 regardless of whether the email exists, so this
    endpoint can't be used to enumerate registered accounts."""
    result = await create_password_reset(body.email)
    if result:
        token, user = result
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        reset_url = f"{frontend_url}/reset-password?token={token}"
        background_tasks.add_task(send_password_reset_email, user["email"], reset_url)
    return {"message": "Se este e-mail estiver cadastrado, você receberá um link de redefinição."}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(body: ResetPasswordRequest):
    try:
        await consume_password_reset(body.token, body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/pause", status_code=status.HTTP_204_NO_CONTENT)
async def pause_user_account(current_user: dict = Depends(get_current_user)):
    await pause_account(current_user["firebase_uid"])


@router.post("/reactivate", status_code=status.HTTP_204_NO_CONTENT)
async def reactivate_user_account(body: ReactivateRequest):
    """Re-enables a paused account. Public endpoint — no auth required."""
    try:
        await reactivate_account(body.email)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email não encontrado.")


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
    data = await db.export_user_data(firebase_uid)
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
    """LGPD Art. 18, V — Portabilidade de dados."""
    background_tasks.add_task(
        _run_data_export,
        firebase_uid=current_user["firebase_uid"],
        email=current_user["email"],
        display_name=current_user.get("display_name") or "",
    )
    return {"message": "Exportação solicitada. Você receberá um e-mail em breve."}


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_account(current_user: dict = Depends(get_current_user)):
    await delete_account(current_user["firebase_uid"])
