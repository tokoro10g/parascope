import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
import sys
import os

# Add backend root to path so we can import src as a package
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from src.main import app

@pytest.mark.asyncio
async def test_physics_calculation_scenario():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create Sheet
        sheet_data = {
            "name": "Physics Calculation",
            "owner_name": "Tester"
        }
        response = await client.post("/sheets/", json=sheet_data)
        assert response.status_code == 200
        sheet = response.json()
        sheet_id = sheet["id"]

        # 2. Define Nodes
        # We need UUIDs for connections
        mass_id = str(uuid4())
        accel_id = str(uuid4())
        func_id = str(uuid4())
        output_id = str(uuid4())

        nodes = [
            {
                "id": mass_id,
                "type": "parameter",
                "label": "Mass",
                "position_x": 0,
                "position_y": 0,
                "data": {"value": 10, "unit": "kg"},
                "outputs": [{"key": "value", "socket_type": "number"}]
            },
            {
                "id": accel_id,
                "type": "parameter",
                "label": "Acceleration",
                "position_x": 0,
                "position_y": 100,
                "data": {"value": 9.8, "unit": "m/s^2"},
                "outputs": [{"key": "value", "socket_type": "number"}]
            },
            {
                "id": func_id,
                "type": "function",
                "label": "Calculate Force",
                "position_x": 200,
                "position_y": 50,
                "data": {"code": "return m * a"},
                "inputs": [
                    {"key": "m", "socket_type": "number"},
                    {"key": "a", "socket_type": "number"}
                ],
                "outputs": [{"key": "result", "socket_type": "number"}]
            },
            {
                "id": output_id,
                "type": "output",
                "label": "Force Output",
                "position_x": 400,
                "position_y": 50,
                "inputs": [{"key": "in", "socket_type": "number"}]
            }
        ]

        # 3. Define Connections
        connections = [
            {
                "source_id": mass_id,
                "target_id": func_id,
                "source_handle": "value",
                "target_handle": "m",
                "source_port": "value",
                "target_port": "m"
            },
            {
                "source_id": accel_id,
                "target_id": func_id,
                "source_handle": "value",
                "target_handle": "a",
                "source_port": "value",
                "target_port": "a"
            },
            {
                "source_id": func_id,
                "target_id": output_id,
                "source_handle": "result",
                "target_handle": "in",
                "source_port": "result",
                "target_port": "in"
            }
        ]

        # 4. Update Sheet with Graph
        update_data = {
            "nodes": nodes,
            "connections": connections
        }
        response = await client.put(f"/sheets/{sheet_id}", json=update_data)
        assert response.status_code == 200

        # 5. Calculate
        response = await client.post(f"/calculate/{sheet_id}")
        assert response.status_code == 200
        results = response.json()

        # 6. Verify Results
        # Mass
        assert results[mass_id]["value"]["val"] == 10
        assert results[mass_id]["value"]["unit"] == "kg"
        # Accel
        assert results[accel_id]["value"]["val"] == 9.8
        assert results[accel_id]["value"]["unit"] == "m / s ** 2"
        # Function (10 * 9.8 = 98.0)
        assert results[func_id]["result"]["val"] == 98.0
        # Unit string might vary slightly depending on pint version/config, but let's check basic structure
        assert "kg" in results[func_id]["result"]["unit"]
        assert "m" in results[func_id]["result"]["unit"]
        assert "s" in results[func_id]["result"]["unit"]
        
        # Output
        assert results[output_id]["val"] == 98.0
        assert "kg" in results[output_id]["unit"]
        assert "m" in results[output_id]["unit"]
        assert "s" in results[output_id]["unit"]

        print("\nCalculation Successful!")
        print(f"Mass: {results[mass_id]}")
        print(f"Accel: {results[accel_id]}")
        print(f"Force: {results[output_id]}")
