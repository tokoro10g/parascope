import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_folder_crud(client: AsyncClient):
    # 1. Create Folder
    response = await client.post("/sheets/folders", json={"name": "Test Folder"})
    assert response.status_code == 200
    folder = response.json()
    folder_id = folder["id"]
    assert folder["name"] == "Test Folder"

    # 2. List Folders
    response = await client.get("/sheets/folders")
    assert response.status_code == 200
    folders = response.json()
    assert any(f["id"] == folder_id for f in folders)

    # 3. Update Folder
    response = await client.put(f"/sheets/folders/{folder_id}", json={"name": "Updated Folder"})
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Folder"

    # 4. Create Subfolder
    response = await client.post("/sheets/folders", json={"name": "Sub", "parent_id": folder_id})
    assert response.status_code == 200
    sub_id = response.json()["id"]

    # 5. Delete Parent (verify sheets move to parent_id - which is None here)
    # First create a sheet in the subfolder
    sheet_res = await client.post("/sheets/", json={"name": "Folder Sheet", "folder_id": sub_id})
    sheet_id = sheet_res.json()["id"]

    response = await client.delete(f"/sheets/folders/{sub_id}")
    assert response.status_code == 200

    # Verify sheet now has parent folder_id (from deleted subfolder's parent)
    response = await client.get(f"/sheets/{sheet_id}")
    assert response.json()["folder_id"] == folder_id

    # Cleanup
    await client.delete(f"/sheets/folders/{folder_id}")

@pytest.mark.asyncio
async def test_sheet_crud_and_history(client: AsyncClient):
    # 1. Create
    sheet_data = {
        "name": "CRUD Sheet",
        "owner_name": "Tester",
        "nodes": [
            {"type": "constant", "label": "C1", "position_x": 0, "position_y": 0, "data": {"value": 1}}
        ]
    }
    response = await client.post("/sheets/", json=sheet_data)
    assert response.status_code == 200
    sheet = response.json()
    sheet_id = sheet["id"]

    # 2. Update (generates audit log)
    update_data = {
        "name": "Renamed Sheet",
        "nodes": [
            {"id": sheet["nodes"][0]["id"], "type": "constant", "label": "C1-new", "position_x": 10, "position_y": 10, "data": {"value": 2}}
        ]
    }
    # Pass user header for audit log
    response = await client.put(f"/sheets/{sheet_id}", json=update_data, headers={"X-Parascope-User": "Tester"})
    assert response.status_code == 200

    # 3. Check History
    response = await client.get(f"/sheets/{sheet_id}/history", headers={"X-Parascope-User": "Tester"})
    assert response.status_code == 200
    history = response.json()
    assert len(history) > 0
    # Check if we have unread status (should be read by the one who saved it)
    assert history[0]["is_unread"] is False

    # 4. Check for updates (from another user's perspective)
    response = await client.get("/sheets/", headers={"X-Parascope-User": "OtherUser"})
    assert response.status_code == 200
    sheets = response.json()
    sheet_summary = next(s for s in sheets if s["id"] == sheet_id)
    assert sheet_summary["has_updates"] is True

    # 5. Mark as read
    await client.post(f"/sheets/{sheet_id}/read", headers={"X-Parascope-User": "OtherUser"})
    response = await client.get("/sheets/", headers={"X-Parascope-User": "OtherUser"})
    sheet_summary = next(s for s in sheets if s["id"] == sheet_id)
    # The has_updates flag should now be False
    # Actually I need to re-fetch it
    sheets_updated = response.json()
    sheet_summary_updated = next(s for s in sheets_updated if s["id"] == sheet_id)
    assert sheet_summary_updated["has_updates"] is False

@pytest.mark.asyncio
async def test_sheet_versions(client: AsyncClient):
    # 1. Create Sheet
    sheet_res = await client.post("/sheets/", json={"name": "Version Sheet"})
    sheet_id = sheet_res.json()["id"]

    # 2. Create Version
    version_data = {"version_tag": "v1.0", "description": "First version"}
    response = await client.post(f"/sheets/{sheet_id}/versions", json=version_data, headers={"X-Parascope-User": "Tester"})
    assert response.status_code == 200
    version = response.json()
    v1_id = version["id"]

    # 3. List Versions
    response = await client.get(f"/sheets/{sheet_id}/versions")
    assert response.status_code == 200
    assert len(response.json()) == 1

    # 4. Get specific version
    response = await client.get(f"/sheets/{sheet_id}/versions/{v1_id}")
    assert response.status_code == 200
    assert response.json()["version_tag"] == "v1.0"

@pytest.mark.asyncio
async def test_sheet_usages(client: AsyncClient):
    # 1. Create Leaf
    leaf_res = await client.post("/sheets/", json={"name": "Leaf"})
    leaf_id = leaf_res.json()["id"]

    # 2. Create Parent
    parent_res = await client.post("/sheets/", json={"name": "Parent"})
    parent_id = parent_res.json()["id"]

    # 3. Link Parent -> Leaf
    update_data = {
        "nodes": [
            {
                "type": "sheet", 
                "label": "Use Leaf", 
                "position_x": 0, "position_y": 0, 
                "data": {"sheetId": leaf_id},
                "inputs": [], "outputs": []
            }
        ]
    }
    await client.put(f"/sheets/{parent_id}", json=update_data)

    # 4. Check Usages of Leaf
    response = await client.get(f"/sheets/{leaf_id}/usages")
    assert response.status_code == 200
    usages = response.json()
    assert len(usages) == 1
    assert usages[0]["parent_sheet_id"] == parent_id
    # Parent has no inputs, so it should be importable/root
    assert usages[0]["can_import"] is True
