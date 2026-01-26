from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_sweep_execution(client: AsyncClient):
    # 1. Create Sheet for Sweep
    sheet_res = await client.post("/sheets/", json={"name": "Sweep Sheet"})
    sheet_id = sheet_res.json()["id"]

    v_id, a_id, func_id, out_id = str(uuid4()), str(uuid4()), str(uuid4()), str(uuid4())

    nodes = [
        {
            "id": v_id,
            "type": "constant",
            "label": "V",
            "position_x": 0,
            "position_y": 0,
            "data": {"value": 10},
            "outputs": [{"key": "value"}],
        },
        {
            "id": a_id,
            "type": "constant",
            "label": "A",
            "position_x": 0,
            "position_y": 100,
            "data": {"value": 45},
            "outputs": [{"key": "value"}],
        },
        {
            "id": func_id,
            "type": "function",
            "label": "Traj",
            "position_x": 200,
            "position_y": 50,
            "data": {"code": "dist = v * math.cos(math.radians(a))"},
            "inputs": [{"key": "v"}, {"key": "a"}],
            "outputs": [{"key": "dist"}],
        },
        {
            "id": out_id,
            "type": "output",
            "label": "Result",
            "position_x": 400,
            "position_y": 50,
            "inputs": [{"key": "value"}],
        },
    ]
    conns = [
        {"source_id": v_id, "target_id": func_id, "source_port": "value", "target_port": "v"},
        {"source_id": a_id, "target_id": func_id, "source_port": "value", "target_port": "a"},
        {"source_id": func_id, "target_id": out_id, "source_port": "dist", "target_port": "value"},
    ]
    await client.put(f"/sheets/{sheet_id}", json={"nodes": nodes, "connections": conns})

    # 2. Run 1D Sweep
    sweep_data = {
        "input_node_id": v_id,
        "start_value": "10",
        "end_value": "20",
        "increment": "10",
        "output_node_ids": [out_id],
        "input_overrides": {},
    }
    response = await client.post(f"/sheets/{sheet_id}/sweep", json=sweep_data)
    assert response.status_code == 200
    res = response.json()
    assert len(res["results"]) == 2  # 10 and 20
    assert len(res["headers"]) == 2  # Input V, Output Result

    # 3. Run 2D Sweep
    sweep_data_2d = {
        "input_node_id": v_id,
        "start_value": "10",
        "end_value": "20",
        "increment": "10",
        "secondary_input_node_id": a_id,
        "secondary_start_value": "0",
        "secondary_end_value": "90",
        "secondary_increment": "90",
        "output_node_ids": [out_id],
        "input_overrides": {},
    }
    response = await client.post(f"/sheets/{sheet_id}/sweep", json=sweep_data_2d)
    assert response.status_code == 200
    res = response.json()
    # (10, 20) x (0, 90) -> 4 steps
    assert len(res["results"]) == 4
    assert len(res["headers"]) == 3  # Input V, Input A, Output Result
