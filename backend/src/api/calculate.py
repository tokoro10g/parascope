import traceback
import uuid
from typing import Any, Dict, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..core.exceptions import GraphExecutionError
# from ..core.graph import GraphProcessor # Deprecated
from ..core.generator import CodeGenerator
from ..core.execution import execute_full_script
from ..models.sheet import Connection, Node, Sheet
from ..schemas.sheet import SheetCreate

router = APIRouter(prefix="/calculate", tags=["calculate"])


class PreviewRequest(BaseModel):
    inputs: Dict[str, Dict[str, Any]] = {}
    graph: SheetCreate


def serialize_result(val: Any) -> Any:
    if isinstance(val, dict):
        return {k: serialize_result(v) for k, v in val.items()}
    if isinstance(val, list):
        return [serialize_result(v) for v in val]
    return val


def _get_input_overrides(
    sheet: Sheet, inputs: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    # Map input labels/IDs to IDs
    input_overrides = {}
    input_nodes_by_label = {n.label: n for n in sheet.nodes if n.type == "input"}
    input_nodes_by_id = {str(n.id): n for n in sheet.nodes if n.type == "input"}

    for key, data in inputs.items():
        val = data.get("value")
        if key in input_nodes_by_label:
            input_overrides[str(input_nodes_by_label[key].id)] = val
        elif key in input_nodes_by_id:
            input_overrides[key] = val
    return input_overrides


async def _run_calculation(
    sheet: Sheet, inputs: Dict[str, Dict[str, Any]], db: AsyncSession
):
    input_overrides = _get_input_overrides(sheet, inputs)

    # Generate script
    generator = CodeGenerator(db)
    script = await generator.generate_full_script(sheet, input_overrides)

    # Execute script
    exec_result = execute_full_script(script)
    results = exec_result.get("results", {})

    # Build detailed response
    detailed_results = {}
    
    # Build edge map: target_node_id -> { target_port: (source_node_id, source_port) }
    edge_map = {}
    for node in sheet.nodes:
        edge_map[str(node.id)] = {}
        
    for conn in sheet.connections:
        t_id = str(conn.target_id)
        if t_id not in edge_map: edge_map[t_id] = {}
        edge_map[t_id][conn.target_port] = (str(conn.source_id), conn.source_port)

    for node in sheet.nodes:
        node_id = str(node.id)

        node_resp = {
            "type": node.type,
            "label": node.label,
            "inputs": {},
            "outputs": {},
            "valid": True,
        }

        res_data = results.get(node_id, {})
        
        # Check for error and validity
        if "error" in res_data and res_data["error"]:
            node_resp["error"] = res_data["error"]
            
        if "valid" in res_data:
            node_resp["valid"] = res_data["valid"]
            
        val = res_data.get("value")

        # Populate inputs
        if node.type not in ["input", "constant"]:
            node_edges = edge_map.get(node_id, {})
            for port, (src_id, src_port) in node_edges.items():
                src_res = results.get(src_id, {})
                src_val = src_res.get("value")
                
                actual_val = None
                if isinstance(src_val, dict) and src_port:
                    actual_val = src_val.get(src_port)
                else:
                    actual_val = src_val
                
                node_resp["inputs"][port] = actual_val

        # Populate outputs
        if node.type in ["function", "sheet"]:
            node_resp["outputs"] = val if val is not None else {}
        else:
            node_resp["outputs"] = {"value": val}

        detailed_results[node_id] = serialize_result(node_resp)
        
    # Global script error?
    if not exec_result.get("success"):
        # We can attach the global error to the response if needed, 
        # or it appeared as node errors?
        # If script failed to parse, results might be empty.
        pass

    return {"results": detailed_results}


def _construct_sheet(body: PreviewRequest) -> Sheet:
    sheet_id = uuid.uuid4()
    nodes = []
    for n in body.graph.nodes:
        node_data = n.model_dump()
        if not node_data.get("id"):
            node_data["id"] = uuid.uuid4()
        nodes.append(Node(**node_data, sheet_id=sheet_id))

    connections = []
    for c in body.graph.connections:
        conn_data = c.model_dump()
        connections.append(Connection(**conn_data, sheet_id=sheet_id))

    return Sheet(
        id=sheet_id,
        name=body.graph.name,
        owner_name=body.graph.owner_name,
        folder_id=body.graph.folder_id,
        nodes=nodes,
        connections=connections,
    )


@router.post("/")
async def calculate_preview(
    body: PreviewRequest,
    db: AsyncSession = Depends(get_db),
):
    sheet = _construct_sheet(body)
    return await _run_calculation(sheet, body.inputs, db)


@router.post("/script")
async def generate_script_preview(
    body: PreviewRequest,
    db: AsyncSession = Depends(get_db),
):
    sheet = _construct_sheet(body)
    input_overrides = _get_input_overrides(sheet, body.inputs)
    
    generator = CodeGenerator(db)
    script = await generator.generate_full_script(sheet, input_overrides)
    return {"script": script}


@router.get("/{sheet_id}/script", response_class=PlainTextResponse)
async def generate_script_sheet(
    sheet_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Sheet)
        .where(Sheet.id == sheet_id)
        .options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
    )
    result = await db.execute(query)
    sheet = result.scalar_one_or_none()

    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    input_overrides = {}
    generator = CodeGenerator(db)
    script = await generator.generate_full_script(sheet, input_overrides)
    return script


@router.post("/{sheet_id}")
async def calculate_sheet(
    sheet_id: UUID,
    inputs: Dict[str, Dict[str, Any]] = None,
    db: AsyncSession = Depends(get_db),
):
    if inputs is None:
        inputs = {}
    query = (
        select(Sheet)
        .where(Sheet.id == sheet_id)
        .options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
    )
    result = await db.execute(query)
    sheet = result.scalar_one_or_none()

    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    return await _run_calculation(sheet, inputs, db)

