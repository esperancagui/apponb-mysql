import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ── POST /submissions (public) ────────────────────────────────────────────────

async def test_create_submission_no_auth_required(async_client: AsyncClient, mock_firestore):
    """Anyone can submit a form (no auth required)."""
    mock_firestore.get_form.return_value = {
        "id": "form_123",
        "workspaceId": "ws_1",
        "name": "Public Form",
    }
    mock_firestore.get_workspace.return_value = {"id": "ws_1", "ownerId": "test_uid_123"}
    mock_firestore.create_submission.return_value = {
        "id": "sub_1",
        "formId": "form_123",
        "workspaceId": "ws_1",
        "status": "new",
        "data": {},
    }

    response = await async_client.post(
        "/api/submissions",
        json={"formId": "form_123", "data": {"name": "Test User"}},
    )
    assert response.status_code == 201
    assert response.json()["id"] == "sub_1"
    mock_firestore.create_submission.assert_called_once()


async def test_create_submission_invalid_form(async_client: AsyncClient, mock_firestore):
    """Submitting to a non-existent form returns 404."""
    mock_firestore.get_form.return_value = None

    response = await async_client.post(
        "/api/submissions", json={"formId": "invalid_form", "data": {}}
    )
    assert response.status_code == 404


async def test_create_submission_response_limit_reached(async_client: AsyncClient, mock_firestore):
    """Workspace at monthly response limit rejects new submissions."""
    mock_firestore.get_form.return_value = {"id": "form_123", "workspaceId": "ws_1"}
    mock_firestore.get_workspace.return_value = {"id": "ws_1", "ownerId": "test_uid_123"}
    # 2000 responses = limit for basic plan
    mock_firestore.count_monthly_submissions.return_value = 2000

    response = await async_client.post(
        "/api/submissions", json={"formId": "form_123", "data": {}}
    )
    assert response.status_code == 403


# ── GET /submissions/{id} ─────────────────────────────────────────────────────

async def test_get_submission_unauthorized(async_client: AsyncClient):
    response = await async_client.get("/api/submissions/sub_1")
    assert response.status_code == 401


async def test_get_submission_authorized(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_submission.return_value = {
        "id": "sub_1",
        "formId": "form_123",
        "workspaceId": "ws_123",
        "status": "new",
        "data": {},
    }

    response = await async_client.get("/api/submissions/sub_1")
    assert response.status_code == 200
    assert response.json()["id"] == "sub_1"


async def test_get_submission_not_found(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_submission.return_value = None
    response = await async_client.get("/api/submissions/nonexistent")
    assert response.status_code == 404


async def test_get_submission_forbidden(async_client: AsyncClient, override_auth, mock_firestore):
    """Submission belongs to a workspace where user has no role."""
    mock_firestore.get_submission.return_value = {
        "id": "sub_x",
        "formId": "form_x",
        "workspaceId": "ws_other",
        "status": "new",
        "data": {},
    }
    mock_firestore.get_workspace.return_value = {"id": "ws_other", "ownerId": "other_user"}
    mock_firestore.get_workspace_members.return_value = []

    response = await async_client.get("/api/submissions/sub_x")
    assert response.status_code == 403
