import traceback
import uuid
from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..core.exceptions import GraphExecutionError
from ..core.graph import GraphProcessor
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


async def _run_calculation(
    sheet: Sheet, inputs: Dict[str, Dict[str, Any]], db: AsyncSession
):
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

    processor = GraphProcessor(sheet, db)

    # Generate script first (for both inspection and execution)
    script = await processor.generate_script(input_overrides=input_overrides)

    # Execute script
    results = await processor.execute_script(script)

    # Build detailed response
    detailed_results = {}
    for node_id, result_val in results.items():
        if node_id not in processor.node_map:
            # Skip results that are not nodes (e.g. internal variables if any leaked, though we filter keys by UUID in execute_script)
            continue

        node = processor.node_map[node_id]

        node_resp = {
            "type": node.type,
            "label": node.label,
            "inputs": {},
            "outputs": {},
            "valid": True,
        }

        # Check for error and validity
        if isinstance(result_val, dict):
            if "error" in result_val:
                node_resp["error"] = result_val["error"]
            if "valid" in result_val:
                node_resp["valid"] = result_val["valid"]

        # Populate inputs
        if node.type not in ["input", "parameter"]:
            in_edges = processor.graph.in_edges(node.id, data=True)
            for u, _v, data in in_edges:
                target_port = data["target_port"]
                source_port = data["source_port"]
                if u in results:
                    source_node = processor.node_map[u]
                    source_res = results[u]
                    val = None

                    # Handle source result being an error dict
                    if isinstance(source_res, dict) and "error" in source_res:
                        val = source_res.get("value")
                    elif source_node.type in ["input", "parameter"]:
                        val = source_res.get("value")
                    elif source_node.type in ["function", "sheet"]:
                        val = source_res.get(source_port)
                    elif source_node.type == "output":
                        val = source_res
                    else:
                        val = source_res

                    node_resp["inputs"][target_port] = val

        # Populate outputs
        if node.type in ["function", "sheet"]:
            node_resp["outputs"] = result_val
        else:
            val = result_val.get("value")
            node_resp["outputs"] = {"value": val}

        detailed_results[str(node_id)] = serialize_result(node_resp)

    return {"results": detailed_results, "script": script}


@router.post("/")
async def calculate_preview(
    body: PreviewRequest,
    db: AsyncSession = Depends(get_db),
):
    # Use a fixed ID or generate one.
    # Since we don't save this sheet, the ID is only used for in-memory mapping.
    sheet_id = uuid.uuid4()

    nodes = []
    for n in body.graph.nodes:
        node_data = n.model_dump()
        # If ID is missing, we must generate it.
        # Ideally frontend provides it.
        if not node_data.get("id"):
            node_data["id"] = uuid.uuid4()

        nodes.append(Node(**node_data, sheet_id=sheet_id))

    connections = []
    for c in body.graph.connections:
        conn_data = c.model_dump()
        connections.append(Connection(**conn_data, sheet_id=sheet_id))

    sheet = Sheet(
        id=sheet_id,
        name=body.graph.name,
        owner_name=body.graph.owner_name,
        folder_id=body.graph.folder_id,
        nodes=nodes,
        connections=connections,
    )

    return await _run_calculation(sheet, body.inputs, db)


@router.post("/{sheet_id}")
async def calculate_sheet(
    sheet_id: UUID,
    inputs: Dict[str, Dict[str, Any]] = None,
    db: AsyncSession = Depends(get_db),
):
    if inputs is None:
        inputs = {}
    # Load sheet with all relations
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

