from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_genai_config(client: AsyncClient):
    response = await client.get("/api/v1/genai/config")
    assert response.status_code == 200
    res = response.json()
    assert "enabled" in res
    assert "available_providers" in res


@pytest.mark.asyncio
async def test_generate_function_mocked(client: AsyncClient):
    mock_provider = AsyncMock()
    mock_provider.generate_function.return_value = {
        "title": "Mock Title",
        "code": "y = x * 2",
        "inputs": ["x"],
        "outputs": ["y"],
        "description": "Mocked description",
    }

    with patch("src.api.genai.get_provider", return_value=mock_provider):
        request_data = {"prompt": "Test prompt", "provider": "gemini"}
        response = await client.post("/api/v1/genai/generate_function", json=request_data)

        assert response.status_code == 200
        res = response.json()
        assert res["title"] == "Mock Title"
        assert res["code"] == "y = x * 2"
        assert res["inputs"] == ["x"]
        assert res["outputs"] == ["y"]
