import pytest
from uuid import uuid4
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_execution_timeout(client: AsyncClient):
    # 1. Create Sheet
    sheet_data = {"name": "Timeout Test", "owner_name": "Tester"}
    response = await client.post("/api/v1/sheets/", json=sheet_data)
    assert response.status_code == 200
    sheet = response.json()
    sheet_id = sheet["id"]

    # 2. Define Node with infinite loop
    func_id = str(uuid4())
    nodes = [
        {
            "id": func_id,
            "type": "function",
            "label": "Infinite Loop",
            "position_x": 0,
            "position_y": 0,
            "data": {"code": "import time\nwhile True: pass"},
            "outputs": [{"key": "result"}],
        }
    ]

    await client.put(f"/api/v1/sheets/{sheet_id}", json={"nodes": nodes, "connections": []})

    # 3. Calculate - this should hit the default 5s timeout
    # We use a long timeout for the client request itself to allow the backend to return its error
    response = await client.post(f"/api/v1/sheets/{sheet_id}/calculate", timeout=10.0) 
    
    assert response.status_code == 200
    res = response.json()
    
    # The global calculation should report success=False or a top-level error
    assert "error" in res
    assert "timed out" in res["error"].lower()
