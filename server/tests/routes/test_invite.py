import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ── POST /invites/{code}/accept ───────────────────────────────────────────────

async def test_join_workspace_unauthorized(async_client: AsyncClient):
    response = await async_client.post("/api/invites/abc/accept")
    assert response.status_code == 401


async def test_join_workspace_success(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_invite_by_code.return_value = {
        "id": "inv_123",
        "workspaceId": "ws_123",
        "role": "member",
        "maxUses": 0,
        "useCount": 0,
    }
    mock_firestore.get_workspace_members.return_value = []
    mock_firestore.get_workspace.return_value = {"id": "ws_123", "ownerId": "test_uid_123"}

    response = await async_client.post("/api/invites/valid_code/accept")

    assert response.status_code == 200
    assert response.json()["workspaceId"] == "ws_123"
    mock_firestore.add_workspace_member.assert_called_once_with("ws_123", "test_uid_123", "member")
    mock_firestore.get_invite_by_code.assert_called_once_with("valid_code")


async def test_join_workspace_invalid_code(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_invite_by_code.return_value = None
    response = await async_client.post("/api/invites/bad_code/accept")
    assert response.status_code == 404


async def test_join_workspace_already_member(async_client: AsyncClient, override_auth, mock_firestore):
    """User already in the workspace → 409."""
    mock_firestore.get_invite_by_code.return_value = {
        "id": "inv_123",
        "workspaceId": "ws_123",
        "role": "member",
        "maxUses": 0,
        "useCount": 0,
    }
    mock_firestore.get_workspace_members.return_value = [
        {"uid": "test_uid_123", "role": "member"}
    ]
    mock_firestore.get_workspace.return_value = {"id": "ws_123", "ownerId": "test_uid_123"}

    response = await async_client.post("/api/invites/valid_code/accept")
    assert response.status_code == 409


async def test_join_workspace_expired_invite(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_invite_by_code.return_value = {
        "id": "inv_exp",
        "workspaceId": "ws_123",
        "role": "member",
        "maxUses": 0,
        "useCount": 0,
        "expiresAt": "2020-01-01T00:00:00+00:00",  # past date
    }

    response = await async_client.post("/api/invites/expired_code/accept")
    assert response.status_code == 410


async def test_join_workspace_max_uses_reached(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_invite_by_code.return_value = {
        "id": "inv_maxed",
        "workspaceId": "ws_123",
        "role": "member",
        "maxUses": 5,
        "useCount": 5,
    }

    response = await async_client.post("/api/invites/maxed_code/accept")
    assert response.status_code == 410


# ── POST /invites/{code}/decline ──────────────────────────────────────────────

async def test_decline_invite_success(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_invite_by_code.return_value = {
        "id": "inv_123",
        "workspaceId": "ws_123",
        "invitedUid": "test_uid_123",
    }

    response = await async_client.post("/api/invites/valid_code/decline")
    assert response.status_code == 204
    mock_firestore.revoke_invite.assert_called_once_with("inv_123")


async def test_decline_invite_not_yours(async_client: AsyncClient, override_auth, mock_firestore):
    """Cannot decline a targeted invite that belongs to another user."""
    mock_firestore.get_invite_by_code.return_value = {
        "id": "inv_123",
        "workspaceId": "ws_123",
        "invitedUid": "other_user_uid",
    }

    response = await async_client.post("/api/invites/other_code/decline")
    assert response.status_code == 403


async def test_decline_invite_not_found(async_client: AsyncClient, override_auth, mock_firestore):
    mock_firestore.get_invite_by_code.return_value = None
    response = await async_client.post("/api/invites/ghost/decline")
    assert response.status_code == 404


# ── GET /invites/pending ──────────────────────────────────────────────────────

async def test_get_pending_invites_unauthorized(async_client: AsyncClient):
    response = await async_client.get("/api/invites/pending")
    assert response.status_code == 401


async def test_get_pending_invites_success(async_client: AsyncClient, override_auth, mock_firestore, mocker):
    mock_firestore.get_pending_invites_for_user.return_value = [
        {
            "id": "inv_1",
            "code": "abc123",
            "workspaceId": "ws_123",
            "role": "member",
            "createdBy": "other_uid",
        }
    ]
    mock_firestore.get_workspace.return_value = {"id": "ws_123", "name": "Test WS"}
    mocker.patch("app.routes.invite.auth_service.get_user_by_firebase_uid", return_value=None)

    response = await async_client.get("/api/invites/pending")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["code"] == "abc123"


# ── GET /invites/{code} (public) ──────────────────────────────────────────────

async def test_get_invite_info_success(async_client: AsyncClient, mock_firestore):
    """Public endpoint — no auth required."""
    mock_firestore.get_invite_by_code.return_value = {
        "id": "inv_123",
        "code": "abc",
        "workspaceId": "ws_123",
        "role": "member",
        "maxUses": 0,
        "useCount": 0,
    }
    mock_firestore.get_workspace.return_value = {
        "id": "ws_123",
        "name": "My Workspace",
        "logoUrl": None,
        "brandColor": "#6366f1",
    }

    response = await async_client.get("/api/invites/abc")
    assert response.status_code == 200
    assert response.json()["workspaceName"] == "My Workspace"
    assert response.json()["role"] == "member"


async def test_get_invite_info_not_found(async_client: AsyncClient, mock_firestore):
    mock_firestore.get_invite_by_code.return_value = None
    response = await async_client.get("/api/invites/nonexistent")
    assert response.status_code == 404
