import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from src.main import app

@pytest.mark.asyncio
async def test_nested_sheet_reuse():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create CHILD Sheet (Multiplier)
        # It takes 'val' input, returns 'val * 2'
        child_res = await client.post("/sheets/", json={"name": "Doubler", "owner_name": "Tester"})
        assert child_res.status_code == 200
        child_id = child_res.json()["id"]

        in_id = str(uuid.uuid4())
        calc_id = str(uuid.uuid4())
        out_id = str(uuid.uuid4())

        child_nodes = [
            {"id": in_id, "type": "input", "label": "InputVal", "data": {"value": 1}},
            {"id": calc_id, "type": "function", "label": "Multiply", "data": {"code": "return x * 2"}, 
             "inputs": [{"key": "x"}], "outputs": [{"key": "y"}]},
            {"id": out_id, "type": "output", "label": "Result", "inputs": [{"key": "val"}]}
        ]
        child_conns = [
            {"source_id": in_id, "target_id": calc_id, "target_port": "x", "source_port": "value"},
            {"source_id": calc_id, "target_id": out_id, "target_port": "val", "source_port": "y"}
        ]
        await client.put(f"/sheets/{child_id}", json={"nodes": child_nodes, "connections": child_conns})

        # 2. Create PARENT Sheet
        # Adds 5 and 10, passes them to TWO instances of Doubler
        # Expect: (5*2) = 10, (10*2) = 20. Total = 30? No, let's just observe outputs
        parent_res = await client.post("/sheets/", json={"name": "Parent", "owner_name": "Tester"})
        parent_id = parent_res.json()["id"]

        c1_id = str(uuid.uuid4())
        c2_id = str(uuid.uuid4())
        sheet1_id = str(uuid.uuid4())
        sheet2_id = str(uuid.uuid4())
        out1_id = str(uuid.uuid4())
        out2_id = str(uuid.uuid4())

        parent_nodes = [
            {"id": c1_id, "type": "constant", "label": "Five", "data": {"value": 5}},
            {"id": c2_id, "type": "constant", "label": "Ten", "data": {"value": 10}},
            # Two nodes referring to SAME child sheet ID
            {"id": sheet1_id, "type": "sheet", "label": "Doubler 1", "data": {"sheetId": child_id}},
            {"id": sheet2_id, "type": "sheet", "label": "Doubler 2", "data": {"sheetId": child_id}},
            {"id": out1_id, "type": "output", "label": "Out1"},
            {"id": out2_id, "type": "output", "label": "Out2"},
        ]
        
        # Connections
        # 5 -> Doubler1 -> Out1
        # 10 -> Doubler2 -> Out2
        # Input name for nested sheet is the label of the input node ("InputVal") or target_port?
        # The generator maps target_port to the input name.
        # So we need to use target_port="InputVal"
        parent_conns = [
            {"source_id": c1_id, "target_id": sheet1_id, "source_port": "value", "target_port": "InputVal"},
            {"source_id": sheet1_id, "target_id": out1_id, "source_port": "Result", "target_port": "val"},
            
            {"source_id": c2_id, "target_id": sheet2_id, "source_port": "value", "target_port": "InputVal"},
            {"source_id": sheet2_id, "target_id": out2_id, "source_port": "Result", "target_port": "val"},
        ]
        
        await client.put(f"/sheets/{parent_id}", json={"nodes": parent_nodes, "connections": parent_conns})

        # 3. Calculate
        calc_res = await client.get(f"/calculate/{parent_id}")
        assert calc_res.status_code == 200
        data = calc_res.json()
        
        # Verify
        # Out1 = 10 (5*2)
        # Out2 = 20 (10*2)
        results = data["results"]
        # Find ID of Out1 node
        val1 = results.get(out1_id, {}).get("value")
        val2 = results.get(out2_id, {}).get("value")
        
        assert val1 == 10
        assert val2 == 20
