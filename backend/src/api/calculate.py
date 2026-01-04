import traceback
from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..core.exceptions import GraphExecutionError
from ..core.graph import GraphProcessor
from ..models.sheet import Sheet

router = APIRouter(prefix="/calculate", tags=["calculate"])


def serialize_result(val: Any) -> Any:
    if isinstance(val, dict):
        return {k: serialize_result(v) for k, v in val.items()}
    if isinstance(val, list):
        return [serialize_result(v) for v in val]
    return val


@router.post("/{sheet_id}")
async def calculate_sheet(
    sheet_id: UUID, inputs: Dict[str, Dict[str, Any]] = None, db: AsyncSession = Depends(get_db)
):
    if inputs is None:
        inputs = {}
    # Load sheet with all relations
    query = (
        select(Sheet).where(Sheet.id == sheet_id).options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
    )
    result = await db.execute(query)
    sheet = result.scalar_one_or_none()

    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

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
    results = await processor.execute(input_overrides=input_overrides)

    # Build detailed response
    detailed_results = {}
    for node_id, result_val in results.items():
        node = processor.node_map[node_id]

        node_resp = {
            "type": node.type,
            "label": node.label,
            "value": None,
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

        # Populate outputs and value
        if node.type in ["function", "sheet"]:
            node_resp["outputs"] = result_val
        else:
            node_resp["value"] = result_val.get("value")
            node_resp["outputs"] = {"value": node_resp["value"]}

        detailed_results[str(node_id)] = serialize_result(node_resp)

    return detailed_results
