import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_lock_lifecycle(client: AsyncClient):
    # 1. Create Sheet
    sheet_res = await client.post("/sheets/", json={"name": "Lock Sheet"})
    sheet_id = sheet_res.json()["id"]

    # 2. Acquire Lock
    lock_data = {"tab_id": "tab1"}
    response = await client.post(
        f"/api/sheets/{sheet_id}/lock",
        json=lock_data,
        headers={"X-Parascope-User": "User1"},
    )
    assert response.status_code == 200
    assert response.json()["user_id"] == "User1"

    # 3. Check status
    response = await client.get(f"/api/sheets/{sheet_id}/lock")
    assert response.status_code == 200
    assert response.json()["user_id"] == "User1"

    # 4. Refresh Lock (same user, same tab)
    response = await client.post(
        f"/api/sheets/{sheet_id}/lock",
        json=lock_data,
        headers={"X-Parascope-User": "User1"},
    )
    assert response.status_code == 200

    # 5. Conflict (same user, different tab)
    response = await client.post(
        f"/api/sheets/{sheet_id}/lock",
        json={"tab_id": "tab2"},
        headers={"X-Parascope-User": "User1"},
    )
    assert response.status_code == 409

    # 6. Conflict (different user)
    response = await client.post(
        f"/api/sheets/{sheet_id}/lock",
        json={"tab_id": "tab1"},
        headers={"X-Parascope-User": "User2"},
    )
    assert response.status_code == 409

    # 7. Force Takeover
    response = await client.post(
        f"/api/sheets/{sheet_id}/lock/force",
        json={"tab_id": "tab3"},
        headers={"X-Parascope-User": "User2"},
    )
    assert response.status_code == 200
    assert response.json()["user_id"] == "User2"

    # 8. List Sessions
    response = await client.get("/api/sessions")
    assert response.status_code == 200
    sessions = response.json()
    assert any(s["user_id"] == "User2" and s["sheet_id"] == sheet_id for s in sessions)

    # 9. Release
    response = await client.delete(f"/api/sheets/{sheet_id}/lock?tab_id=tab3", headers={"X-Parascope-User": "User2"})
    assert response.status_code == 200

    # Verify free
    response = await client.get(f"/api/sheets/{sheet_id}/lock")
    assert response.status_code == 200
    assert response.json() is None
