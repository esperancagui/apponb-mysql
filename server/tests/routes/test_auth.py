import pytest
from unittest.mock import patch, MagicMock
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
            "created_at": "2026-01-01T00:00:00Z",
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


async def test_pause_account_error(async_client: AsyncClient, override_auth, mock_firestore, mocker):
    mocker.patch("app.routes.auth.pause_account", side_effect=Exception("Firebase error"))
    response = await async_client.post("/api/v1/auth/pause")
    assert response.status_code == 500


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
    # Background task calls export_user_data; return empty dict so json.dumps succeeds
    mock_firestore.export_user_data.return_value = {}
    response = await async_client.post("/api/v1/auth/request-export")
    assert response.status_code == 202
    assert "message" in response.json()


# ── POST /register — abuse checks ─────────────────────────────────────────────

async def test_register_blocks_disposable_email(async_client: AsyncClient, mocker):
    """Disposable email domain must be rejected with 403."""
    mock_decoded = {"uid": "uid_abc"}
    mocker.patch("app.routes.auth.firebase_auth.verify_id_token", return_value=mock_decoded)
    mocker.patch("app.routes.auth.get_user_by_firebase_uid", return_value=None)
    mocker.patch(
        "app.routes.auth.validate_email_domain",
        return_value="Não é possível criar conta com e-mail temporário.",
    )

    response = await async_client.post(
        "/api/v1/auth/register",
        json={"firebase_uid": "uid_abc", "email": "user@mailinator.com"},
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 403
    assert "temporário" in response.json()["detail"]


async def test_register_blocks_reused_email(async_client: AsyncClient, mocker):
    """Email used by a previously deleted account must be rejected."""
    mocker.patch("app.routes.auth.firebase_auth.verify_id_token", return_value={"uid": "uid_abc"})
    mocker.patch("app.routes.auth.get_user_by_firebase_uid", return_value=None)
    mocker.patch("app.routes.auth.validate_email_domain", return_value=None)
    mocker.patch("app.routes.auth.check_email_previously_used", return_value=True)

    response = await async_client.post(
        "/api/v1/auth/register",
        json={"firebase_uid": "uid_abc", "email": "used@example.com"},
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 403
    assert "teste gratuito" in response.json()["detail"]


async def test_register_blocks_reused_fingerprint(async_client: AsyncClient, mocker):
    """Browser fingerprint already used in another trial must be rejected."""
    mocker.patch("app.routes.auth.firebase_auth.verify_id_token", return_value={"uid": "uid_abc"})
    mocker.patch("app.routes.auth.get_user_by_firebase_uid", return_value=None)
    mocker.patch("app.routes.auth.validate_email_domain", return_value=None)
    mocker.patch("app.routes.auth.check_email_previously_used", return_value=False)
    mocker.patch("app.routes.auth.check_fingerprint_used", return_value=True)

    response = await async_client.post(
        "/api/v1/auth/register",
        json={"firebase_uid": "uid_abc", "email": "new@example.com", "fingerprint": "fp_abc"},
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 403
    assert "dispositivo" in response.json()["detail"]


async def test_register_returns_existing_user(async_client: AsyncClient, mocker):
    """If the user already exists in Firestore, return it without creating again."""
    from datetime import datetime, timezone

    existing = {
        "id": "existing_uuid",
        "email": "existing@example.com",
        "display_name": "Existing User",
        "photo_url": None,
        "firebase_uid": "uid_existing",
        "created_at": datetime.now(timezone.utc),
        "plan": "basic",
        "subscription_status": "active",
        "current_period_end": None,
        "trial_end": None,
    }
    mocker.patch("app.routes.auth.firebase_auth.verify_id_token", return_value={"uid": "uid_existing"})
    mocker.patch("app.routes.auth.get_user_by_firebase_uid", return_value=existing)

    response = await async_client.post(
        "/api/v1/auth/register",
        json={"firebase_uid": "uid_existing", "email": "existing@example.com"},
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 201
    assert response.json()["id"] == "existing_uuid"
