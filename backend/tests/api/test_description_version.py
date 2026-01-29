import pytest
from uuid import uuid4
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_node_description_and_version_tag(client: AsyncClient):
    # 1. Create a child sheet to be used as a versioned sub-sheet
    child_res = await client.post("/api/v1/sheets/", json={"name": "Child Sheet"})
    child_id = child_res.json()["id"]
    
    # Create a version for the child sheet
    version_res = await client.post(
        f"/api/v1/sheets/{child_id}/versions", 
        json={"version_tag": "v1.2.3", "description": "Version description"},
        headers={"X-Parascope-User": "Tester"}
    )
    version_id = version_res.json()["id"]

    # 2. Create a parent sheet with nodes containing descriptions and a versioned sheet node
    sheet_data = {
        "name": "Metadata Test Sheet",
        "owner_name": "Tester",
        "nodes": [
            {
                "type": "constant",
                "label": "C1",
                "position_x": 0,
                "position_y": 0,
                "data": {"value": 10, "description": "Constant description"}
            },
            {
                "type": "function",
                "label": "F1",
                "position_x": 100,
                "position_y": 0,
                "data": {"code": "y = x", "description": "Function description"}
            },
            {
                "type": "sheet",
                "label": "S1",
                "position_x": 200,
                "position_y": 0,
                "data": {"sheetId": child_id, "versionId": version_id}
            },
            {
                "type": "lut",
                "label": "L1",
                "position_x": 300,
                "position_y": 0,
                "data": {
                    "description": "LUT description",
                    "lut": {"rows": [{"key": "A", "values": {"v": 1}}]}
                }
            },
            {
                "type": "comment",
                "label": "Comment",
                "position_x": 400,
                "position_y": 0,
                "data": {"description": "Markdown comment content"}
            }
        ]
    }
    
    create_res = await client.post("/api/v1/sheets/", json=sheet_data)
    assert create_res.status_code == 200
    sheet_id = create_res.json()["id"]

    # 3. Fetch the sheet and verify metadata propagation
    response = await client.get(f"/api/v1/sheets/{sheet_id}")
    assert response.status_code == 200
    nodes = response.json()["nodes"]
    
    # Sort nodes by label for easy access
    nodes_by_label = {n["label"]: n for n in nodes}
    
    # Verify Constant description
    assert nodes_by_label["C1"]["data"]["description"] == "Constant description"
    
    # Verify Function description
    assert nodes_by_label["F1"]["data"]["description"] == "Function description"
    
    # Verify LUT description
    assert nodes_by_label["L1"]["data"]["description"] == "LUT description"
    
    # Verify Comment content (stored in description)
    assert nodes_by_label["Comment"]["data"]["description"] == "Markdown comment content"
    
    # Verify Sheet versionTag (should be enriched by the API)
    # Note: Label "S1" is automatically synchronized to "Child Sheet"
    assert nodes_by_label["Child Sheet"]["data"]["versionTag"] == "v1.2.3"
