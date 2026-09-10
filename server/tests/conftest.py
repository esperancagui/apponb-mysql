import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock
from datetime import datetime, timedelta, timezone

from app.core.auth import get_current_user
from main import app


# ── Fake user ──────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_auth_user():
    """Fake authenticated user on an active trial (Pro access)."""
    return {
        "id": "test_uuid_123",
        "firebase_uid": "test_uid_123",
        "email": "test@example.com",
        "display_name": "Test User",
        "photo_url": "https://example.com/photo.png",
        "created_at": "2026-01-01T00:00:00Z",
        "plan": "free",
        "subscription_status": "trialing",
        # trial_end in the future so plan_limits resolves to "basic"
        "trial_end": datetime.now(timezone.utc) + timedelta(days=10),
    }


# ── ASGI test client ───────────────────────────────────────────────────────────

@pytest_asyncio.fixture(loop_scope="function")
async def async_client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        yield client


# ── Auth override ──────────────────────────────────────────────────────────────

@pytest.fixture
def override_auth(mock_auth_user):
    async def override_get_current_user():
        return mock_auth_user

    app.dependency_overrides[get_current_user] = override_get_current_user
    yield
    app.dependency_overrides.clear()


# ── Firestore mock ─────────────────────────────────────────────────────────────

@pytest.fixture
def mock_firestore(mocker, mock_auth_user):
    """
    Patches firestore_db everywhere it's imported (routes + plan_limits).
    Also pre-configures default return values that satisfy plan_limits checks
    so tests don't 403 unexpectedly.
    """
    mock_db = AsyncMock()

    # ── Default return values for plan_limits helpers ──────────────────────────
    # get_user_by_firebase_uid → trialing user → effective plan = "basic"
    mock_db.get_user_by_firebase_uid.return_value = mock_auth_user
    # workspace owned by the test user
    mock_db.get_workspace.return_value = {
        "id": "ws_123",
        "ownerId": "test_uid_123",
        "name": "Test Workspace",
    }
    # User owns 0 workspaces (below limit)
    mock_db.get_workspaces_by_owner.return_value = []
    # 0 members and 0 responses (below limits)
    mock_db.count_workspace_members.return_value = 0
    mock_db.count_monthly_submissions.return_value = 0
    # No email collision by default (registration tests)
    mock_db.get_user_by_email.return_value = None

    # ── Patch every module that imports the MySQL data layer (still aliased
    # `firestore_db` at the import site — see app/services/db.py's docstring) ──
    for target in [
        "app.core.permissions.firestore_db",
        "app.core.plan_limits.firestore_db",
        "app.routes.workspace.firestore_db",
        "app.routes.form.firestore_db",
        "app.routes.submission.firestore_db",
        "app.routes.inbox.firestore_db",
        "app.routes.invite.firestore_db",
        "app.routes.insight.firestore_db",
        "app.services.insight_service.firestore_db",
        "app.routes.auth.db",
    ]:
        mocker.patch(target, mock_db)

    return mock_db
