from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_physics_simulation(client: AsyncClient):
    # 1. Create Sheet
    sheet_data = {"name": "Physics Calculation", "owner_name": "Tester"}
    response = await client.post("/api/v1/sheets/", json=sheet_data)
    assert response.status_code == 200
    sheet = response.json()
    sheet_id = sheet["id"]

    # 2. Define Nodes
    mass_id = str(uuid4())
    accel_id = str(uuid4())
    func_id = str(uuid4())
    output_id = str(uuid4())

    nodes = [
        {
            "id": mass_id,
            "type": "constant",
            "label": "Mass",
            "position_x": 0,
            "position_y": 0,
            "data": {"value": 10},
            "outputs": [{"key": "value"}],
        },
        {
            "id": accel_id,
            "type": "constant",
            "label": "Acceleration",
            "position_x": 0,
            "position_y": 100,
            "data": {"value": 9.8},
            "outputs": [{"key": "value"}],
        },
        {
            "id": func_id,
            "type": "function",
            "label": "Calculate Force",
            "position_x": 200,
            "position_y": 50,
            "data": {"code": "result = m * a"},
            "inputs": [{"key": "m"}, {"key": "a"}],
            "outputs": [{"key": "result"}],
        },
        {
            "id": output_id,
            "type": "output",
            "label": "Force Output",
            "position_x": 400,
            "position_y": 50,
            "inputs": [{"key": "value"}],
        },
    ]

    connections = [
        {"source_id": mass_id, "target_id": func_id, "source_port": "value", "target_port": "m"},
        {"source_id": accel_id, "target_id": func_id, "source_port": "value", "target_port": "a"},
        {"source_id": func_id, "target_id": output_id, "source_port": "result", "target_port": "value"},
    ]

    await client.put(f"/api/v1/sheets/{sheet_id}", json={"nodes": nodes, "connections": connections})

    # 3. Calculate
    response = await client.post(f"/api/v1/sheets/{sheet_id}/calculate")
    assert response.status_code == 200
    results = response.json()["results"]

    assert results[mass_id]["outputs"]["value"] == "10"
    assert results[accel_id]["outputs"]["value"] == "9.8"
    assert float(results[func_id]["outputs"]["result"]) == 98.0
    assert float(results[output_id]["outputs"]["value"]) == 98.0


@pytest.mark.asyncio
async def test_nested_reuse(client: AsyncClient):
    # 1. Create CHILD Sheet (Multiplier)
    child_res = await client.post("/api/v1/sheets/", json={"name": "Doubler", "owner_name": "Tester"})
    child_id = child_res.json()["id"]

    in_id, calc_id, out_id = str(uuid4()), str(uuid4()), str(uuid4())
    child_nodes = [
        {"id": in_id, "type": "input", "label": "X", "position_x": 0, "position_y": 0, "outputs": [{"key": "value"}]},
        {
            "id": calc_id,
            "type": "function",
            "label": "M",
            "position_x": 200,
            "position_y": 0,
            "data": {"code": "y = x * 2"},
            "inputs": [{"key": "x"}],
            "outputs": [{"key": "y"}],
        },
        {
            "id": out_id,
            "type": "output",
            "label": "Y",
            "position_x": 400,
            "position_y": 0,
            "inputs": [{"key": "value"}],
        },
    ]
    child_conns = [
        {"source_id": in_id, "target_id": calc_id, "source_port": "value", "target_port": "x"},
        {"source_id": calc_id, "target_id": out_id, "source_port": "y", "target_port": "value"},
    ]
    await client.put(f"/api/v1/sheets/{child_id}", json={"nodes": child_nodes, "connections": child_conns})

    # 2. Create PARENT Sheet
    parent_res = await client.post("/api/v1/sheets/", json={"name": "Parent"})
    parent_id = parent_res.json()["id"]

    c1_id, sheet1_id, out1_id = str(uuid4()), str(uuid4()), str(uuid4())
    parent_nodes = [
        {
            "id": c1_id,
            "type": "constant",
            "label": "Val",
            "position_x": 0,
            "position_y": 0,
            "data": {"value": 5},
            "outputs": [{"key": "value"}],
        },
        {
            "id": sheet1_id,
            "type": "sheet",
            "label": "D",
            "position_x": 200,
            "position_y": 0,
            "data": {"sheetId": child_id},
        },
        {
            "id": out1_id,
            "type": "output",
            "label": "Result",
            "position_x": 400,
            "position_y": 0,
            "inputs": [{"key": "value"}],
        },
    ]
    parent_conns = [
        {"source_id": c1_id, "target_id": sheet1_id, "source_port": "value", "target_port": "X"},
        {"source_id": sheet1_id, "target_id": out1_id, "source_port": "Y", "target_port": "value"},
    ]
    await client.put(f"/api/v1/sheets/{parent_id}", json={"nodes": parent_nodes, "connections": parent_conns})

    # 3. Calculate
    calc_res = await client.post(f"/api/v1/sheets/{parent_id}/calculate")
    assert calc_res.status_code == 200
    results = calc_res.json()["results"]
    assert results[out1_id]["outputs"]["value"] == "10"


@pytest.mark.asyncio
async def test_option_validation(client: AsyncClient):
    sheet_res = await client.post("/api/v1/sheets/", json={"name": "Options"})
    sheet_id = sheet_res.json()["id"]

    node_id = str(uuid4())
    nodes = [
        {
            "id": node_id,
            "type": "constant",
            "label": "Opt",
            "position_x": 0,
            "position_y": 0,
            "data": {"dataType": "option", "options": ["A", "B"], "value": "A"},
            "outputs": [{"key": "value"}],
        }
    ]
    await client.put(f"/api/v1/sheets/{sheet_id}", json={"nodes": nodes, "connections": []})

    # Valid
    res = await client.post(f"/api/v1/sheets/{sheet_id}/calculate")
    assert res.json()["results"][node_id]["is_computable"] is True

    # Invalid
    nodes[0]["data"]["value"] = "C"
    await client.put(f"/api/v1/sheets/{sheet_id}", json={"nodes": nodes})
    res = await client.post(f"/api/v1/sheets/{sheet_id}/calculate")
    assert res.json()["results"][node_id]["is_computable"] is True  # Soft fail
    assert "is not in allowed options" in res.json()["results"][node_id]["error"]


@pytest.mark.asyncio
async def test_calculate_preview(client: AsyncClient):
    # Test calculation without saving to DB first
    node_id = str(uuid4())
    graph_data = {
        "name": "Preview",
        "nodes": [
            {
                "id": node_id,
                "type": "constant",
                "label": "Val",
                "position_x": 0,
                "position_y": 0,
                "data": {"value": 42},
                "outputs": [{"key": "value"}],
            }
        ],
        "connections": [],
    }

    response = await client.post("/api/v1/calculate/", json={"graph": graph_data, "inputs": {}})
    assert response.status_code == 200
    assert response.json()["results"][node_id]["outputs"]["value"] == "42"


@pytest.mark.asyncio
async def test_cycle_detection(client: AsyncClient):
    sheet_res = await client.post("/api/v1/sheets/", json={"name": "Cycle"})
    sheet_id = sheet_res.json()["id"]

    n1, n2 = str(uuid4()), str(uuid4())
    nodes = [
        {
            "id": n1,
            "type": "function",
            "label": "A",
            "position_x": 0,
            "position_y": 0,
            "data": {"code": "y=x"},
            "inputs": [{"key": "x"}],
            "outputs": [{"key": "y"}],
        },
        {
            "id": n2,
            "type": "function",
            "label": "B",
            "position_x": 200,
            "position_y": 0,
            "data": {"code": "y=x"},
            "inputs": [{"key": "x"}],
            "outputs": [{"key": "y"}],
        },
    ]
    conns = [
        {"source_id": n1, "target_id": n2, "source_port": "y", "target_port": "x"},
        {"source_id": n2, "target_id": n1, "source_port": "y", "target_port": "x"},
    ]
    await client.put(f"/api/v1/sheets/{sheet_id}", json={"nodes": nodes, "connections": conns})

    response = await client.post(f"/api/v1/sheets/{sheet_id}/calculate")
    # The backend returns 200 with an 'error' field when calculation fails gracefully
    assert response.status_code == 200
    assert "Cycle detected" in response.json()["error"]


@pytest.mark.asyncio
async def test_nested_error_propagation(client: AsyncClient):
    # 1. Create Child with error (division by zero)
    child_res = await client.post("/api/v1/sheets/", json={"name": "Divider"})
    child_id = child_res.json()["id"]
    n_id = str(uuid4())
    nodes = [
        {
            "id": n_id,
            "type": "function",
            "label": "Div0",
            "position_x": 0,
            "position_y": 0,
            "data": {"code": "x = 1 / 0"},
            "outputs": [{"key": "x"}],
        }
    ]
    await client.put(f"/api/v1/sheets/{child_id}", json={"nodes": nodes})

    # 2. Create Parent using that child
    parent_res = await client.post("/api/v1/sheets/", json={"name": "Parent"})
    parent_id = parent_res.json()["id"]
    p_node_id = str(uuid4())
    p_nodes = [
        {
            "id": p_node_id,
            "type": "sheet",
            "label": "UseChild",
            "position_x": 0,
            "position_y": 0,
            "data": {"sheetId": child_id},
        }
    ]
    await client.put(f"/api/v1/sheets/{parent_id}", json={"nodes": p_nodes})

    # 3. Calculate Parent
    response = await client.post(f"/api/v1/sheets/{parent_id}/calculate")
    assert response.status_code == 200
    results = response.json()["results"]

    # Nested sheet node should be invalid
    assert results[p_node_id]["is_computable"] is False
    assert "division by zero" in results[p_node_id]["error"]


@pytest.mark.asyncio
async def test_function_node_errors(client: AsyncClient):
    sheet_res = await client.post("/api/v1/sheets/", json={"name": "Error Sheet"})
    sheet_id = sheet_res.json()["id"]

    # 1. Test Runtime Error (Division by zero)
    n1 = str(uuid4())
    nodes = [
        {
            "id": n1,
            "type": "function",
            "label": "Div0",
            "position_x": 0,
            "position_y": 0,
            "data": {"code": "x = 1 / 0"},
            "outputs": [{"key": "x"}],
        }
    ]
    await client.put(f"/api/v1/sheets/{sheet_id}", json={"nodes": nodes})

    response = await client.post(f"/api/v1/sheets/{sheet_id}/calculate")
    assert response.status_code == 200
    res = response.json()
    assert res["results"][n1]["is_computable"] is False
    assert "division by zero" in res["results"][n1]["error"]

    # 2. Test Syntax Error
    nodes[0]["data"]["code"] = "x = (1 + 2"  # Missing closing parenthesis
    await client.put(f"/api/v1/sheets/{sheet_id}", json={"nodes": nodes})

    response = await client.post(f"/api/v1/sheets/{sheet_id}/calculate")
    assert response.status_code == 200
    res = response.json()
    assert res["results"][n1]["is_computable"] is False
    assert "SyntaxError" in res["results"][n1]["error"]


@pytest.mark.asyncio
async def test_input_persistence_and_standalone_default(client: AsyncClient):
    """
    Verifies that 'input' node values are saved to the database and
    used as example/default values when running as a standalone sheet.
    """
    sheet_res = await client.post("/api/v1/sheets/", json={"name": "Input Persistence"})
    sheet_id = sheet_res.json()["id"]

    input_id = str(uuid4())
    nodes = [
        {
            "id": input_id,
            "type": "input",
            "label": "X",
            "position_x": 0,
            "position_y": 0,
            "data": {"value": "42"},  # Saved 'example' value
            "outputs": [{"key": "value"}],
        }
    ]
    await client.put(f"/api/v1/sheets/{sheet_id}", json={"nodes": nodes})

    # 1. Verify it's actually saved in the DB
    read_res = await client.get(f"/api/v1/sheets/{sheet_id}")
    saved_node = next(n for n in read_res.json()["nodes"] if n["id"] == input_id)
    assert saved_node["data"]["value"] == "42"

    # 2. Calculate WITHOUT providing inputs - should use the saved '42'
    calc_res = await client.post(f"/api/v1/sheets/{sheet_id}/calculate", json={})
    assert calc_res.status_code == 200
    assert calc_res.json()["results"][input_id]["outputs"]["value"] == "42"

    # 3. Calculate WITH explicit input override - should use the provided '100'
    calc_res_override = await client.post(f"/api/v1/sheets/{sheet_id}/calculate", json={"X": {"value": 100}})
    assert calc_res_override.json()["results"][input_id]["outputs"]["value"] == "100"


@pytest.mark.asyncio
async def test_nested_input_strictness(client: AsyncClient):
    """
    Verifies that saved values in 'input' nodes are IGNORED when the sheet
    is used as a nested sheet (function). Nested sheets MUST get inputs
    from their parent.
    """
    # 1. Create CHILD Sheet with a saved input value
    child_res = await client.post("/api/v1/sheets/", json={"name": "Child with Default"})
    child_id = child_res.json()["id"]

    in_id = str(uuid4())
    out_id = str(uuid4())
    child_nodes = [
        {
            "id": in_id,
            "type": "input",
            "label": "X",
            "data": {"value": "999"},  # This should be ignored in nested mode
            "position_x": 0,
            "position_y": 0,
            "outputs": [{"key": "value"}],
        },
        {"id": out_id, "type": "output", "label": "Y", "position_x": 0, "position_y": 0, "inputs": [{"key": "value"}]},
    ]
    child_conns = [{"source_id": in_id, "target_id": out_id, "source_port": "value", "target_port": "value"}]
    await client.put(f"/api/v1/sheets/{child_id}", json={"nodes": child_nodes, "connections": child_conns})

    # 2. Create PARENT Sheet using the child but NOT connecting the input
    parent_res = await client.post("/api/v1/sheets/", json={"name": "Parent"})
    parent_id = parent_res.json()["id"]

    sheet_node_id = str(uuid4())
    parent_nodes = [
        {
            "id": sheet_node_id,
            "type": "sheet",
            "label": "Nested",
            "data": {"sheetId": child_id},
            "position_x": 0,
            "position_y": 0,
            "inputs": [{"key": "X"}],
            "outputs": [{"key": "Y"}],
        }
    ]
    await client.put(f"/api/v1/sheets/{parent_id}", json={"nodes": parent_nodes})

    # 3. Calculate Parent - The nested sheet should report missing input
    # because it should NOT fall back to '999'.
    calc_res = await client.post(f"/api/v1/sheets/{parent_id}/calculate", json={})
    assert calc_res.status_code == 200

    # Check result of the nested node
    results = calc_res.json()["results"]
    assert sheet_node_id in results
    nested_res = results[sheet_node_id]
    assert nested_res["is_computable"] is False
    assert "Input 'X' required" in nested_res["nodes"][in_id]["error"]
