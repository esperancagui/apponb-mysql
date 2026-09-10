import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_get_inbox_unauthorized(async_client: AsyncClient):
    """Test getting inbox without auth."""
    response = await async_client.get("/api/inbox")
    assert response.status_code == 401


async def test_get_inbox_all_workspaces(
    async_client: AsyncClient, override_auth, mock_firestore
):
    """Test that the global inbox fetches from all workspaces (owned AND member)."""

    # 1. User has access to two workspaces
    mock_firestore.get_workspaces_for_user.return_value = [
        {"id": "ws_owned", "ownerId": "test_uid_123"},
        {"id": "ws_member", "ownerId": "other_user"},
    ]

    # 2. Both workspaces have submissions
    def mock_get_subs(ws_id):
        if ws_id == "ws_owned":
            return [
                {"id": "sub_1", "formId": "f1", "workspaceId": "ws_owned", "data": {}}
            ]
        elif ws_id == "ws_member":
            return [
                {"id": "sub_2", "formId": "f2", "workspaceId": "ws_member", "data": {}}
            ]
        return []

    mock_firestore.get_submissions_by_workspace.side_effect = mock_get_subs
    mock_firestore.get_form.return_value = {
        "name": "Mocked Form",
        "clientName": "Test Client",
    }

    # Act
    response = await async_client.get("/api/inbox")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    # Verifies our fix! It requested all workspaces for the user
    mock_firestore.get_workspaces_for_user.assert_called_once_with("test_uid_123")


async def test_dashboard_stats_aggregation(
    async_client: AsyncClient, override_auth, mock_firestore
):
    """Test that the dashboard stats aggregate across all available workspaces."""

    mock_firestore.get_workspaces_for_user.return_value = [{"id": "ws_1"}]

    mock_firestore.get_forms.return_value = [{"id": "form_1"}]

    # Provide two submissions (1 new, 1 reviewing)
    mock_firestore.get_submissions.return_value = [
        {
            "id": "sub_1",
            "formId": "form_1",
            "data": {},
            "status": "new",
            "createdAt": "2026-03-01T10:00:00Z",
        },
        {
            "id": "sub_2",
            "formId": "form_1",
            "data": {},
            "status": "reviewing",
            "createdAt": "2026-03-02T10:00:00Z",
        },
    ]

    # No risk insights for simplicity
    mock_firestore.get_insights_for_submissions.return_value = {}

    response = await async_client.get("/api/dashboard/stats")

    assert response.status_code == 200
    stats = response.json()

    assert stats["newCount"] == 1
    assert stats["reviewingCount"] == 1
