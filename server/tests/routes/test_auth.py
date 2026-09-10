import pytest
from datetime import datetime, timezone
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ── GET /me ────────────────────────────────────────────────────────────────────

async def test_get_me_unauthorized(async_client: AsyncClient):
    response = await async_client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_get_me_authorized(async_client: AsyncClient, override_auth, mock_firestore):
    response = await async_client.get("/api/v1/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["firebase_uid"] == "test_uid_123"


# ── PATCH /profile ─────────────────────────────────────────────────────────────

async def test_update_profile_unauthorized(async_client: AsyncClient):
    response = await async_client.patch("/api/v1/auth/profile", json={"display_name": "New"})
    assert response.status_code == 401


async def test_update_profile_success(async_client: AsyncClient, override_auth, mock_firestore, mocker):
    mocker.patch(
        "app.routes.auth.update_user_profile",
        return_value={
            "id": "test_uuid_123",
            "email": "test@example.com",
            "display_name": "Updated Name",
            "photo_url": None,
            "firebase_uid": "test_uid_123",
            "created_at": datetime.now(timezone.utc),
        },
    )
    response = await async_client.patch("/api/v1/auth/profile", json={"display_name": "Updated Name"})
    assert response.status_code == 200
    assert response.json()["display_name"] == "Updated Name"


async def test_update_profile_no_fields(async_client: AsyncClient, override_auth, mock_firestore):
    response = await async_client.patch("/api/v1/auth/profile", json={})
    assert response.status_code == 422


# ── PATCH /preferences ─────────────────────────────────────────────────────────

async def test_update_preferences_success(async_client: AsyncClient, override_auth, mock_firestore, mocker):
    mocker.patch(
        "app.routes.auth.update_user_preferences",
        return_value={"email_notifications": False, "language": "en"},
    )
    response = await async_client.patch(
        "/api/v1/auth/preferences", json={"email_notifications": False, "language": "en"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email_notifications"] is False
    assert data["language"] == "en"


async def test_update_preferences_no_fields(async_client: AsyncClient, override_auth, mock_firestore):
    response = await async_client.patch("/api/v1/auth/preferences", json={})
    assert response.status_code == 422


# ── POST /pause ────────────────────────────────────────────────────────────────

async def test_pause_account_unauthorized(async_client: AsyncClient):
    response = await async_client.post("/api/v1/auth/pause")
    assert response.status_code == 401


async def test_pause_account_success(async_client: AsyncClient, override_auth, mock_firestore, mocker):
    mocker.patch("app.routes.auth.pause_account")
    response = await async_client.post("/api/v1/auth/pause")
    assert response.status_code == 204


# ── DELETE /account ────────────────────────────────────────────────────────────

async def test_delete_account_unauthorized(async_client: AsyncClient):
    response = await async_client.delete("/api/v1/auth/account")
    assert response.status_code == 401


async def test_delete_account_success(async_client: AsyncClient, override_auth, mock_firestore, mocker):
    mocker.patch("app.routes.auth.delete_account")
    response = await async_client.delete("/api/v1/auth/account")
    assert response.status_code == 204


# ── POST /request-export ───────────────────────────────────────────────────────

async def test_request_export_unauthorized(async_client: AsyncClient):
    response = await async_client.post("/api/v1/auth/request-export")
    assert response.status_code == 401


async def test_request_export_accepted(async_client: AsyncClient, override_auth, mock_firestore):
    """Should return 202 immediately and schedule background task."""
    mock_firestore.export_user_data.return_value = {}
    response = await async_client.post("/api/v1/auth/request-export")
    assert response.status_code == 202
    assert "message" in response.json()


# ── POST /register — abuse checks ─────────────────────────────────────────────

async def test_register_blocks_disposable_email(async_client: AsyncClient, mock_firestore, mocker):
    """Disposable email domain must be rejected with 403."""
    mocker.patch(
        "app.routes.auth.validate_email_domain",
        return_value="Não é possível criar conta com e-mail temporário.",
    )

    response = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "user@mailinator.com", "password": "supersecret1"},
    )
    assert response.status_code == 403
    assert "temporário" in response.json()["detail"]


async def test_register_blocks_reused_email(async_client: AsyncClient, mock_firestore, mocker):
    """Email used by a previously deleted account must be rejected."""
    mocker.patch("app.routes.auth.validate_email_domain", return_value=None)
    mocker.patch("app.routes.auth.check_email_previously_used", return_value=True)

    response = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "used@example.com", "password": "supersecret1"},
    )
    assert response.status_code == 403
    assert "teste gratuito" in response.json()["detail"]


async def test_register_blocks_reused_fingerprint(async_client: AsyncClient, mock_firestore, mocker):
    """Browser fingerprint already used in another trial must be rejected."""
    mocker.patch("app.routes.auth.validate_email_domain", return_value=None)
    mocker.patch("app.routes.auth.check_email_previously_used", return_value=False)
    mocker.patch("app.routes.auth.check_fingerprint_used", return_value=True)

    response = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "supersecret1", "fingerprint": "fp_abc"},
    )
    assert response.status_code == 403
    assert "dispositivo" in response.json()["detail"]


async def test_register_blocks_existing_email(async_client: AsyncClient, mock_firestore):
    """An email already registered (and not soft-deleted) must be rejected with 409."""
    mock_firestore.get_user_by_email.return_value = {"id": "existing_uuid"}

    response = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "existing@example.com", "password": "supersecret1"},
    )
    assert response.status_code == 409


async def test_register_success(async_client: AsyncClient, mock_firestore, mocker):
    """Happy path: creates the user and returns a token pair."""
    created = {
        "id": "new_uuid",
        "email": "new@example.com",
        "display_name": None,
        "photo_url": None,
        "firebase_uid": "abc123",
        "created_at": datetime.now(timezone.utc),
        "plan": "free",
        "subscription_status": "trialing",
        "current_period_end": None,
        "trial_end": datetime.now(timezone.utc),
    }
    mocker.patch("app.routes.auth.validate_email_domain", return_value=None)
    mocker.patch("app.routes.auth.check_email_previously_used", return_value=False)
    mocker.patch("app.routes.auth.create_user", return_value=created)

    response = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "supersecret1"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["id"] == "new_uuid"
    assert "access_token" in body
    assert "refresh_token" in body


async def test_register_rejects_short_password(async_client: AsyncClient, mock_firestore):
    response = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "short"},
    )
    assert response.status_code == 422


# ── POST /login ─────────────────────────────────────────────────────────────

async def test_login_invalid_credentials(async_client: AsyncClient, mocker):
    mocker.patch("app.routes.auth.authenticate", return_value=None)
    response = await async_client.post(
        "/api/v1/auth/login", json={"email": "nope@example.com", "password": "wrong"}
    )
    assert response.status_code == 401


async def test_login_disabled_account(async_client: AsyncClient, mocker):
    mocker.patch("app.routes.auth.authenticate", side_effect=PermissionError("account-disabled"))
    response = await async_client.post(
        "/api/v1/auth/login", json={"email": "paused@example.com", "password": "whatever1"}
    )
    assert response.status_code == 403
