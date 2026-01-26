import os
import sys
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

# Add backend root to path so we can import src as a package
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from src.main import app


@pytest.mark.asyncio
async def test_option_validation(client: AsyncClient):
    # 1. Create Sheet
    sheet_data = {"name": "Option Validation Test", "owner_name": "Tester"}
    response = await client.post("/sheets/", json=sheet_data)
    assert response.status_code == 200
    sheet = response.json()
    sheet_id = sheet["id"]

    # 2. Define Nodes
    param_id = str(uuid4())
    input_id = str(uuid4())
    output_id = str(uuid4())

    nodes = [
        {
            "id": param_id,
            "type": "constant",
            "label": "Material",
            "position_x": 0,
            "position_y": 0,
            "data": {
                "dataType": "option",
                "options": ["Steel", "Aluminum"],
                "value": "Steel"
            },
            "outputs": [{"key": "value", "socket_type": "any"}],
        },
        {
            "id": input_id,
            "type": "input",
            "label": "Mode",
            "position_x": 0,
            "position_y": 100,
            "data": {
                "dataType": "option",
                "options": ["Fast", "Accurate"],
                "value": "Fast" # Default value
            },
            "outputs": [{"key": "value", "socket_type": "any"}],
        },
        {
            "id": output_id,
            "type": "output",
            "label": "Result",
            "position_x": 200,
            "position_y": 50,
            "inputs": [{"key": "value", "socket_type": "any"}],
        }
    ]

    # No connections needed for basic validation test, 
    # but let's connect param to output to verify value passing
    connections = [
         {
            "source_id": param_id,
            "target_id": output_id,
            "source_port": "value",
            "target_port": "value",
        },
    ]

    # 3. Update Sheet
    update_data = {"nodes": nodes, "connections": connections}
    response = await client.put(f"/sheets/{sheet_id}", json=update_data)
    assert response.status_code == 200

    # 4. Test Valid Parameter
    response = await client.post(f"/calculate/{sheet_id}")
    assert response.status_code == 200
    results = response.json()["results"]
    assert results[param_id]["outputs"]["value"] == "Steel"

    # 5. Test Invalid Parameter (Update sheet with invalid value)
    nodes[0]["data"]["value"] = "Titanium" # Not in options
    response = await client.put(f"/sheets/{sheet_id}", json={"nodes": nodes, "connections": connections})
    assert response.status_code == 200
    
    response = await client.post(f"/calculate/{sheet_id}")
    assert response.status_code == 200
    results = response.json()["results"]
    assert results[param_id]["valid"] is True # Validation errors are soft fails
    assert "is not in allowed options" in results[param_id]["error"]
    assert results[param_id]["outputs"]["value"] == "Titanium"

    # Reset Parameter to valid
    nodes[0]["data"]["value"] = "Steel"
    await client.put(f"/sheets/{sheet_id}", json={"nodes": nodes, "connections": connections})

    # 6. Test Valid Input Override
    response = await client.post(f"/calculate/{sheet_id}", json={input_id: {"value": "Accurate"}})
    assert response.status_code == 200
    results = response.json()["results"]
    assert results[input_id]["outputs"]["value"] == "Accurate"

    # 7. Test Invalid Input Override
    response = await client.post(f"/calculate/{sheet_id}", json={input_id: {"value": "Slow"}})
    assert response.status_code == 200
    results = response.json()["results"]
    assert results[input_id]["valid"] is True # Soft fail
    assert "is not in allowed options" in results[input_id]["error"]
    assert results[input_id]["outputs"]["value"] == "Slow"

