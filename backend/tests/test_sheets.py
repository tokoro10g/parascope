import os
import sys
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

# Add backend root to path so we can import src as a package
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from src.main import app


@pytest.mark.asyncio
async def test_sheet_crud_and_dependencies():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # --- CRUD Tests ---
        # 1. Create Sheet with Nodes and Connections
        node1_id = str(uuid4())
        node2_id = str(uuid4())
        sheet_data = {
            "name": "Test Sheet",
            "owner_name": "Tester",
            "nodes": [
                {
                    "id": node1_id,
                    "type": "constant",
                    "label": "Param 1",
                    "position_x": 0,
                    "position_y": 0,
                    "data": {"value": 10},
                },
                {"id": node2_id, "type": "output", "label": "Output 1", "position_x": 200, "position_y": 0, "data": {}},
            ],
            "connections": [
                {"source_id": node1_id, "target_id": node2_id, "source_port": "output", "target_port": "input"}
            ],
        }
        response = await client.post("/sheets/", json=sheet_data)
        assert response.status_code == 200
        sheet = response.json()
        sheet_id = sheet["id"]
        assert sheet["name"] == "Test Sheet"
        assert len(sheet["nodes"]) == 2
        assert len(sheet["connections"]) == 1

        # 2. Duplicate Sheet
        response = await client.post(f"/sheets/{sheet_id}/duplicate")
        assert response.status_code == 200
        dup_sheet = response.json()
        assert dup_sheet["name"] == "Test Sheet (Copy)"
        assert dup_sheet["id"] != sheet_id
        dup_id = dup_sheet["id"]

        # 3. List Sheets
        response = await client.get("/sheets/")
        assert response.status_code == 200
        sheets = response.json()
        ids = [s["id"] for s in sheets]
        assert sheet_id in ids
        assert dup_id in ids

        # 4. Delete Original Sheet
        response = await client.delete(f"/sheets/{sheet_id}")
        assert response.status_code == 204

        # 5. Verify Deletion
        response = await client.get(f"/sheets/{sheet_id}")
        assert response.status_code == 404

        # 6. Verify Duplicate Still Exists
        response = await client.get(f"/sheets/{dup_id}")
        assert response.status_code == 200

        # 7. Delete Duplicate
        response = await client.delete(f"/sheets/{dup_id}")
        assert response.status_code == 204

        # 8. Update Sheet (Verify Connections Persist)
        # Create a new sheet for update test
        sheet_data = {"name": "Update Test", "owner_name": "Tester", "nodes": [], "connections": []}
        response = await client.post("/sheets/", json=sheet_data)
        update_id = response.json()["id"]

        node1_id = str(uuid4())
        node2_id = str(uuid4())
        update_data = {
            "name": "Updated Name",
            "nodes": [
                {
                    "id": node1_id,
                    "type": "constant",
                    "label": "Param 1",
                    "position_x": 0,
                    "position_y": 0,
                    "data": {"value": 10},
                },
                {"id": node2_id, "type": "output", "label": "Output 1", "position_x": 200, "position_y": 0, "data": {}},
            ],
            "connections": [
                {"source_id": node1_id, "target_id": node2_id, "source_port": "output", "target_port": "input"}
            ],
        }
        response = await client.put(f"/sheets/{update_id}", json=update_data)
        assert response.status_code == 200
        updated_sheet = response.json()
        assert updated_sheet["name"] == "Updated Name"
        assert len(updated_sheet["nodes"]) == 2
        assert len(updated_sheet["connections"]) == 1

        # Verify persistence
        response = await client.get(f"/sheets/{update_id}")
        fetched_sheet = response.json()
        assert len(fetched_sheet["connections"]) == 1

        # --- Dependency Check Tests ---
        # 1. Create Sheet A (to be nested)
        sheet_a_data = {"name": "Sheet A", "owner_name": "Tester"}
        response = await client.post("/sheets/", json=sheet_a_data)
        sheet_a_id = response.json()["id"]

        # 2. Create Sheet B (parent)
        sheet_b_data = {"name": "Sheet B", "owner_name": "Tester"}
        response = await client.post("/sheets/", json=sheet_b_data)
        sheet_b_id = response.json()["id"]

        # 3. Add Node to Sheet B referencing Sheet A
        node_id = str(uuid4())
        update_data = {
            "nodes": [
                {
                    "id": node_id,
                    "type": "sheet",
                    "label": "Nested Sheet A",
                    "position_x": 0,
                    "position_y": 0,
                    "data": {"sheetId": sheet_a_id},
                    "inputs": [],
                    "outputs": [],
                }
            ]
        }
        response = await client.put(f"/sheets/{sheet_b_id}", json=update_data)
        assert response.status_code == 200

        # 4. Attempt to Delete Sheet A
        response = await client.delete(f"/sheets/{sheet_a_id}")

        # 5. Assert Failure
        assert response.status_code == 400
        assert "Cannot delete sheet. It is used in 'Sheet B'" in response.json()["detail"]
