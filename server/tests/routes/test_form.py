import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

# ── POST /forms ────────────────────────────────────────────────────────────────

async def test_create_form_unauthorized(async_client: AsyncClient):
    response = await async_client.post(
        "/api/forms", json={"name": "Test Form", "workspaceId": "ws_123"}
    )
    assert response.status_code == 401


async def test_create_form_authorized(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.create_form.return_value = {
        "id": "form_123",
        "name": "Test Form",
        "workspaceId": "ws_123",
    }

    response = await async_client.post(
        "/api/forms", json={"name": "Test Form", "workspaceId": "ws_123"}
    )

    assert response.status_code == 201
    assert response.json()["id"] == "form_123"
    mock_firestore.get_workspace.assert_called_with("ws_123")
    mock_firestore.create_form.assert_called_once()


async def test_create_form_forbidden_workspace(async_client: AsyncClient, override_auth, mock_firestore):
    """User has no role in the workspace → 403."""
    mock_firestore.get_workspace.return_value = {
        "id": "ws_other",
        "ownerId": "different_user",
    }
    mock_firestore.get_workspace_members.return_value = []

    response = await async_client.post(
        "/api/forms", json={"name": "Hacked Form", "workspaceId": "ws_other"}
    )

    assert response.status_code == 403
    mock_firestore.create_form.assert_not_called()


async def test_create_form_no_workspace_auto_assigns(async_client: AsyncClient, override_auth, mock_firestore):
    """When workspaceId is omitted, the server auto-assigns the user's first workspace."""
    mock_firestore.get_workspaces_by_owner.return_value = [
        {"id": "ws_auto", "ownerId": "test_uid_123"}
    ]
    mock_firestore.create_form.return_value = {
        "id": "form_auto",
        "name": "Auto Workspace Form",
        "workspaceId": "ws_auto",
    }

    response = await async_client.post("/api/forms", json={"name": "Auto Workspace Form"})

    assert response.status_code == 201
    assert response.json()["workspaceId"] == "ws_auto"


async def test_create_form_no_workspace_no_workspaces(async_client: AsyncClient, override_auth, mock_firestore):
    """If user has no workspaces and doesn't provide one, return 400."""
    mock_firestore.get_workspaces_by_owner.return_value = []

    response = await async_client.post("/api/forms", json={"name": "Orphan Form"})
    assert response.status_code == 400


# ── GET /forms ─────────────────────────────────────────────────────────────────

async def test_list_forms_unauthorized(async_client: AsyncClient):
    response = await async_client.get("/api/forms")
    assert response.status_code == 401


async def test_list_forms_all_workspaces(async_client: AsyncClient, override_auth, mock_firestore):
    """Without workspace_id filter, returns forms from all user workspaces."""
    mock_firestore.get_workspaces_for_user.return_value = [
        {"id": "ws_1"}, {"id": "ws_2"}
    ]
    mock_firestore.get_forms.side_effect = lambda ws_id: (
        [{"id": "f1", "name": "Form 1", "workspaceId": "ws_1"}] if ws_id == "ws_1" else
        [{"id": "f2", "name": "Form 2", "workspaceId": "ws_2"}]
    )

    response = await async_client.get("/api/forms")
    assert response.status_code == 200
    assert len(response.json()) == 2


async def test_list_forms_filtered_by_workspace(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_forms.return_value = [
        {"id": "f1", "name": "Form 1", "workspaceId": "ws_123"}
    ]
    response = await async_client.get("/api/forms?workspace_id=ws_123")
    assert response.status_code == 200
    assert len(response.json()) == 1
    mock_firestore.get_forms.assert_called_once_with("ws_123")


# ── GET /forms/{id} ────────────────────────────────────────────────────────────

async def test_get_form_authorized(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_form.return_value = {
        "id": "form_123",
        "name": "My Form",
        "workspaceId": "ws_123",
        "ownerId": "test_uid_123",
    }

    response = await async_client.get("/api/forms/form_123")
    assert response.status_code == 200
    assert response.json()["id"] == "form_123"


async def test_get_form_not_found(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_form.return_value = None
    response = await async_client.get("/api/forms/nonexistent")
    assert response.status_code == 404


async def test_get_form_forbidden(async_client: AsyncClient, override_auth, mock_firestore):
    """User is not owner and has no workspace role → 403."""
    mock_firestore.get_form.return_value = {
        "id": "form_other",
        "ownerId": "other_user",
        "workspaceId": "ws_other",
    }
    mock_firestore.get_workspace.return_value = {"id": "ws_other", "ownerId": "other_user"}
    mock_firestore.get_workspace_members.return_value = []

    response = await async_client.get("/api/forms/form_other")
    assert response.status_code == 403


# ── GET /forms/public/{slug} ───────────────────────────────────────────────────

async def test_get_form_public_success(async_client: AsyncClient, mock_firestore):
    """Public form route requires no auth."""
    mock_firestore.get_form_by_slug.return_value = {
        "id": "form_pub",
        "name": "Public Form",
        "slug": "meu-briefing",
    }
    response = await async_client.get("/api/forms/public/meu-briefing")
    assert response.status_code == 200
    assert response.json()["slug"] == "meu-briefing"


async def test_get_form_public_not_found(async_client: AsyncClient, mock_firestore):
    mock_firestore.get_form_by_slug.return_value = None
    response = await async_client.get("/api/forms/public/slug-inexistente")
    assert response.status_code == 404


# ── PUT /forms/{id} ────────────────────────────────────────────────────────────

async def test_update_form_authorized(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_form.return_value = {
        "id": "form_123",
        "ownerId": "test_uid_123",
        "workspaceId": "ws_123",
    }
    mock_firestore.update_form.return_value = {
        "id": "form_123",
        "name": "Updated Name",
        "workspaceId": "ws_123",
    }

    response = await async_client.put("/api/forms/form_123", json={"name": "Updated Name"})
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"


async def test_update_form_forbidden(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_form.return_value = {
        "id": "form_other",
        "ownerId": "other_user",
        "workspaceId": "ws_other",
    }
    mock_firestore.get_workspace.return_value = {"id": "ws_other", "ownerId": "other_user"}
    mock_firestore.get_workspace_members.return_value = []

    response = await async_client.put("/api/forms/form_other", json={"name": "Hack"})
    assert response.status_code == 403


# ── DELETE /forms/{id} ────────────────────────────────────────────────────────

async def test_delete_form_authorized(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_form.return_value = {
        "id": "form_123",
        "ownerId": "test_uid_123",
        "workspaceId": "ws_123",
    }

    response = await async_client.delete("/api/forms/form_123")
    assert response.status_code == 204
    mock_firestore.delete_form.assert_called_once_with("form_123")


async def test_delete_form_forbidden(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_form.return_value = {
        "id": "form_other",
        "ownerId": "other_user",
        "workspaceId": "ws_other",
    }
    mock_firestore.get_workspace.return_value = {"id": "ws_other", "ownerId": "other_user"}
    mock_firestore.get_workspace_members.return_value = []

    response = await async_client.delete("/api/forms/form_other")
    assert response.status_code == 403
    mock_firestore.delete_form.assert_not_called()


# ── GET /forms/{id}/submissions ───────────────────────────────────────────────

async def test_list_form_submissions(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_form.return_value = {
        "id": "form_123",
        "ownerId": "test_uid_123",
        "workspaceId": "ws_123",
    }
    mock_firestore.get_submissions.return_value = [
        {"id": "sub_1", "formId": "form_123", "workspaceId": "ws_123", "status": "new", "data": {}},
        {"id": "sub_2", "formId": "form_123", "workspaceId": "ws_123", "status": "reviewing", "data": {}},
    ]

    response = await async_client.get("/api/forms/form_123/submissions")
    assert response.status_code == 200
    assert len(response.json()) == 2
