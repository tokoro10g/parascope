import uuid
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_nested_sheet_reuse(client: AsyncClient):
    # 1. Create CHILD Sheet (Multiplier)
    # It takes 'val' input, returns 'val * 2'
    child_res = await client.post("/sheets/", json={"name": "Doubler", "owner_name": "Tester"})
    assert child_res.status_code == 200
    child_id = child_res.json()["id"]

    in_id = str(uuid.uuid4())
    calc_id = str(uuid.uuid4())
    out_id = str(uuid.uuid4())

    child_nodes = [
        {"id": in_id, "type": "input", "label": "InputVal", "position_x": 0, "position_y": 0, "data": {"value": 1},
         "outputs": [{"key": "value"}]},
        {"id": calc_id, "type": "function", "label": "Multiply", "position_x": 200, "position_y": 0, "data": {"code": "y = x * 2"}, 
         "inputs": [{"key": "x"}], "outputs": [{"key": "y"}]},
        {"id": out_id, "type": "output", "label": "Result", "position_x": 400, "position_y": 0, "inputs": [{"key": "value"}]}
    ]
    child_conns = [
        {"source_id": in_id, "target_id": calc_id, "target_port": "x", "source_port": "value"},
        {"source_id": calc_id, "target_id": out_id, "target_port": "value", "source_port": "y"}
    ]
    res = await client.put(f"/sheets/{child_id}", json={"nodes": child_nodes, "connections": child_conns})
    assert res.status_code == 200

    # 2. Create PARENT Sheet
    # Adds 5 and 10, passes them to TWO instances of Doubler
    parent_res = await client.post("/sheets/", json={"name": "Parent", "owner_name": "Tester"})
    assert parent_res.status_code == 200
    parent_id = parent_res.json()["id"]

    c1_id = str(uuid.uuid4())
    c2_id = str(uuid.uuid4())
    sheet1_id = str(uuid.uuid4())
    sheet2_id = str(uuid.uuid4())
    out1_id = str(uuid.uuid4())
    out2_id = str(uuid.uuid4())

    parent_nodes = [
        {"id": c1_id, "type": "constant", "label": "Five", "position_x": 0, "position_y": 0, "data": {"value": 5}, "outputs": [{"key": "value"}]},
        {"id": c2_id, "type": "constant", "label": "Ten", "position_x": 0, "position_y": 100, "data": {"value": 10}, "outputs": [{"key": "value"}]},
        # Two nodes referring to SAME child sheet ID
        {"id": sheet1_id, "type": "sheet", "label": "Doubler 1", "position_x": 300, "position_y": 0, "data": {"sheetId": child_id}},
        {"id": sheet2_id, "type": "sheet", "label": "Doubler 2", "position_x": 300, "position_y": 100, "data": {"sheetId": child_id}},
        {"id": out1_id, "type": "output", "label": "Out1", "position_x": 600, "position_y": 0, "inputs": [{"key": "value"}]},
        {"id": out2_id, "type": "output", "label": "Out2", "position_x": 600, "position_y": 100, "inputs": [{"key": "value"}]},
    ]
    
    # Input name for nested sheet is the label of the input node ("InputVal")
    parent_conns = [
        {"source_id": c1_id, "target_id": sheet1_id, "source_port": "value", "target_port": "InputVal"},
        {"source_id": sheet1_id, "target_id": out1_id, "source_port": "Result", "target_port": "value"},
        
        {"source_id": c2_id, "target_id": sheet2_id, "source_port": "value", "target_port": "InputVal"},
        {"source_id": sheet2_id, "target_id": out2_id, "source_port": "Result", "target_port": "value"},
    ]
    
    res = await client.put(f"/sheets/{parent_id}", json={"nodes": parent_nodes, "connections": parent_conns})
    assert res.status_code == 200

    # 3. Calculate
    calc_res = await client.post(f"/calculate/{parent_id}")
    assert calc_res.status_code == 200
    data = calc_res.json()
    
    # Verify
    # Out1 = 10 (5*2)
    # Out2 = 20 (10*2)
    results = data["results"]
    
    val1 = results.get(out1_id, {}).get("outputs", {}).get("value")
    val2 = results.get(out2_id, {}).get("outputs", {}).get("value")
    
    assert val1 == 10
    assert val2 == 20
