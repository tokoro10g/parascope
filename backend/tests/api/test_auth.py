import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_username_validation(client: AsyncClient):
    # Valid username
    response = await client.get("/sheets/", headers={"X-Parascope-User": "valid_user_123"})
    assert response.status_code == 200

    # Invalid username (contains special characters not allowed by regex ^[a-zA-Z0-9_]+$)
    # Note: Regex is set in docker-compose.test.yml
    response = await client.get("/sheets/", headers={"X-Parascope-User": "invalid-user!"})
    assert response.status_code == 400
    assert "Invalid username format" in response.json()["detail"]

    # Missing username (should be allowed but returns None for get_current_user)
    response = await client.get("/sheets/")
    assert response.status_code == 200
