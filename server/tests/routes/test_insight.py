import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock

pytestmark = pytest.mark.asyncio


async def test_analyze_submission_success(
    async_client: AsyncClient, override_auth, mock_firestore, mocker
):
    """Test the AI analysis endpoint, mocking DeepSeek and SocketIO."""

    # 1. Mock the user's access to the submission
    mock_firestore.get_submission.return_value = {
        "id": "sub_1",
        "formId": "form_1",
        "workspaceId": "ws_1",
        "data": {"name": "Cliente Teste", "answers": "Sim"},
    }
    mock_firestore.get_workspace.return_value = {
        "id": "ws_1",
        "ownerId": "test_uid_123",
    }

    # 2. Mock that there is NO existing insight yet
    mock_firestore.get_insight_by_submission.return_value = None

    # 3. Mock the AI Service (so we don't call DeepSeek API)
    mock_ai = AsyncMock()
    mock_ai.generate_insight.return_value = (
        {
            "scoreONB": {"classificacao": "Bom", "nota": 8},
            "resumo": "Teste",
        },  # parsed_insight
        "prompt",  # raw_prompt
        "response",  # raw_response
    )
    mocker.patch("app.routes.insight.ai_service", mock_ai)

    # 4. Mock the saved DB result
    mock_firestore.create_insight.return_value = {
        "id": "insight_1",
        "submissionId": "sub_1",
        "headerImpacto": {"headline": "Test", "status": "Ready"},
        "diagnosticoEstrategico": {
            "visaoGeral": "Test",
            "dorDoCliente": "Test",
            "potencialDeLucro": "Test",
        },
        "scoreONB": {"pontuacao": 10, "classificacao": "Bom", "analiseTecnica": "Test"},
        "redFlagsEstrategicas": [],
        "perfilPsicografico": {"perfil": "Test", "estrategaDeVenda": "Test"},
        "kickoffMasterlist": {"perguntasDeOuro": ["1"], "proximoPasso": "Test"},
    }

    # 5. Act
    response = await async_client.post("/api/submissions/sub_1/analyze")

    # 6. Assert
    assert response.status_code == 200
    assert response.json()["id"] == "insight_1"

    # Verify AI was called with the submission data
    mock_ai.generate_insight.assert_called_once()
    mock_firestore.create_insight.assert_called_once()
