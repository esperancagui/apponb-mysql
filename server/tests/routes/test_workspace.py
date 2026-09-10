import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ── GET /workspaces ────────────────────────────────────────────────────────────

async def test_get_workspaces_unauthorized(async_client: AsyncClient):
    response = await async_client.get("/api/workspaces")
    assert response.status_code == 401


async def test_get_workspaces(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_workspaces_for_user.return_value = [
        {"id": "ws_1", "name": "Workspace 1", "ownerId": "test_uid_123"},
        {"id": "ws_2", "name": "Workspace 2", "ownerId": "other_uid"},
    ]

    response = await async_client.get("/api/workspaces")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    mock_firestore.get_workspaces_for_user.assert_called_once_with("test_uid_123")


# ── GET /workspaces/{id} ───────────────────────────────────────────────────────

async def test_get_workspace_success(async_client: AsyncClient, override_auth, mock_firestore):
    response = await async_client.get("/api/workspaces/ws_123")
    assert response.status_code == 200
    assert response.json()["id"] == "ws_123"


async def test_get_workspace_not_found(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_workspace.return_value = None
    response = await async_client.get("/api/workspaces/nonexistent")
    assert response.status_code == 404


async def test_get_workspace_forbidden(async_client: AsyncClient, override_auth, mock_firestore):
    """Non-member cannot fetch the workspace."""
    mock_firestore.get_workspace.return_value = {"id": "ws_other", "ownerId": "other_user"}
    mock_firestore.get_workspace_members.return_value = []

    response = await async_client.get("/api/workspaces/ws_other")
    assert response.status_code == 403


# ── POST /workspaces ───────────────────────────────────────────────────────────

async def test_create_workspace_unauthorized(async_client: AsyncClient):
    response = await async_client.post(
        "/api/workspaces", json={"name": "New Space", "slug": "new-space"}
    )
    assert response.status_code == 401


async def test_create_workspace_authorized(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.create_workspace.return_value = {
        "id": "ws_new",
        "name": "New Space",
        "ownerId": "test_uid_123",
    }

    response = await async_client.post(
        "/api/workspaces", json={"name": "New Space", "slug": "new-space"}
    )

    assert response.status_code == 201
    assert response.json()["id"] == "ws_new"
    assert response.json()["name"] == "New Space"

    mock_firestore.create_workspace.assert_called_once()
    called_args = mock_firestore.create_workspace.call_args[0][0]
    assert called_args["name"] == "New Space"
    assert called_args["ownerId"] == "test_uid_123"


async def test_create_workspace_plan_limit(async_client: AsyncClient, override_auth, mock_firestore):
    """User on basic plan with 3 workspaces already → 403."""
    mock_firestore.get_workspaces_by_owner.return_value = [
        {"id": f"ws_{i}"} for i in range(3)
    ]

    response = await async_client.post(
        "/api/workspaces", json={"name": "4th Workspace", "slug": "fourth"}
    )
    assert response.status_code == 403


# ── DELETE /workspaces/{id} ────────────────────────────────────────────────────

async def test_delete_workspace_owner_success(async_client: AsyncClient, override_auth, mock_firestore):
    response = await async_client.delete("/api/workspaces/ws_123")
    assert response.status_code == 204
    mock_firestore.delete_workspace.assert_called_once_with("ws_123")


async def test_delete_workspace_non_owner_forbidden(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_workspace.return_value = {"id": "ws_other", "ownerId": "other_user"}

    response = await async_client.delete("/api/workspaces/ws_other")
    assert response.status_code == 403
    mock_firestore.delete_workspace.assert_not_called()


# ── GET /workspaces/{id}/members ───────────────────────────────────────────────

async def test_get_members_owner_only(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_workspace_members.return_value = [
        {"uid": "test_uid_123", "role": "owner", "email": "test@example.com", "name": "Test User"},
        {"uid": "member_uid", "role": "member", "email": "member@example.com", "name": "Member"},
    ]

    response = await async_client.get("/api/workspaces/ws_123/members")
    assert response.status_code == 200
    assert len(response.json()) == 2


async def test_get_members_non_owner_forbidden(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_workspace.return_value = {"id": "ws_other", "ownerId": "other_user"}

    response = await async_client.get("/api/workspaces/ws_other/members")
    assert response.status_code == 403


# ── POST /workspaces/{id}/members ──────────────────────────────────────────────

async def test_add_member_success(async_client: AsyncClient, override_auth, mock_firestore, mocker):
    mock_fb_user = MagicMock()
    mock_fb_user.uid = "new_member_uid"
    mock_fb_user.email = "newmember@example.com"
    mocker.patch("app.routes.workspace.firebase_auth_admin.get_user_by_email", return_value=mock_fb_user)

    response = await async_client.post(
        "/api/workspaces/ws_123/members",
        json={"email": "newmember@example.com", "role": "member"},
    )

    assert response.status_code == 201
    mock_firestore.add_workspace_member.assert_called_once_with("ws_123", "new_member_uid", "member")


async def test_add_member_duplicate(async_client: AsyncClient, override_auth, mock_firestore, mocker):
    """Cannot add a member who is already in the workspace → 409."""
    mock_fb_user = MagicMock()
    mock_fb_user.uid = "existing_uid"
    mock_fb_user.email = "existing@example.com"
    mocker.patch("app.routes.workspace.firebase_auth_admin.get_user_by_email", return_value=mock_fb_user)
    mock_firestore.get_workspace_members.return_value = [
        {"uid": "existing_uid", "role": "member"}
    ]

    response = await async_client.post(
        "/api/workspaces/ws_123/members",
        json={"email": "existing@example.com", "role": "member"},
    )
    assert response.status_code == 409
    mock_firestore.add_workspace_member.assert_not_called()


async def test_add_member_user_not_found(async_client: AsyncClient, override_auth, mock_firestore, mocker):
    """Email not registered in Firebase → 404."""
    from firebase_admin import auth as fb_auth_mod
    mocker.patch(
        "app.routes.workspace.firebase_auth_admin.get_user_by_email",
        side_effect=fb_auth_mod.UserNotFoundError("not found"),
    )

    response = await async_client.post(
        "/api/workspaces/ws_123/members",
        json={"email": "ghost@example.com", "role": "member"},
    )
    assert response.status_code == 404


async def test_add_member_invalid_role(async_client: AsyncClient, override_auth, mock_firestore, mocker):
    mock_fb_user = MagicMock()
    mock_fb_user.uid = "uid_x"
    mock_fb_user.email = "x@example.com"
    mocker.patch("app.routes.workspace.firebase_auth_admin.get_user_by_email", return_value=mock_fb_user)

    response = await async_client.post(
        "/api/workspaces/ws_123/members",
        json={"email": "x@example.com", "role": "superadmin"},
    )
    assert response.status_code == 400


# ── DELETE /workspaces/{id}/members/{uid} ─────────────────────────────────────

async def test_remove_member_success(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_workspace_members.return_value = [
        {"uid": "member_uid", "role": "member"},
        {"uid": "test_uid_123", "role": "owner"},
    ]

    response = await async_client.delete("/api/workspaces/ws_123/members/member_uid")
    assert response.status_code == 204
    mock_firestore.remove_workspace_member.assert_called_once_with("ws_123", "member_uid")


async def test_remove_owner_blocked(async_client: AsyncClient, override_auth, mock_firestore):
    """Cannot remove the workspace owner — route returns 400."""
    response = await async_client.delete("/api/workspaces/ws_123/members/test_uid_123")
    assert response.status_code == 400
    mock_firestore.remove_workspace_member.assert_not_called()


from unittest.mock import MagicMock