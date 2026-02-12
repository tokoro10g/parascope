from typing import Any, Dict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.sheet import Sheet
from .execution import execute_full_script
from .generator import CodeGenerator
from .utils import serialize_result


def get_input_overrides(sheet: Sheet, inputs: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
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


async def enrich_results(sheet: Sheet, raw_results: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    detailed_results = {}

    # Build edge map: target_node_id -> { target_port: (source_node_id, source_port) }
    edge_map = {}
    for node in sheet.nodes:
        edge_map[str(node.id)] = {}

    for conn in sheet.connections:
        t_id = str(conn.target_id)
        if t_id not in edge_map:
            edge_map[t_id] = {}
        edge_map[t_id][conn.target_port] = (str(conn.source_id), conn.source_port)

    # 3. Identify all nested sheets needed
    nested_sheet_ids = []
    for node in sheet.nodes:
        if node.type == "sheet":
            sid = node.data.get("sheetId")
            if sid:
                nested_sheet_ids.append(sid)

    nested_sheets_map = {}
    if nested_sheet_ids:
        # We need to fetch full definitions
        stmt = (
            select(Sheet)
            .where(Sheet.id.in_(nested_sheet_ids))
            .options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
        )
        res = await db.execute(stmt)
        for s in res.scalars().all():
            nested_sheets_map[str(s.id)] = s

    for node in sheet.nodes:
        node_id = str(node.id)

        node_resp = {
            "type": node.type,
            "label": node.label,
            "inputs": {},
            "outputs": {},
            "is_computable": True,
        }

        res_data = raw_results.get(node_id, {})

        # Check for error and computability
        if "error" in res_data and res_data["error"]:
            node_resp["error"] = res_data["error"]
            if res_data.get("internal_error") == "Dependency failed":
                node_resp["is_dependency_error"] = True

        if "is_computable" in res_data:
            node_resp["is_computable"] = res_data["is_computable"]

        val = res_data.get("value")

        # Populate inputs
        if node.type not in ["input", "constant"]:
            node_edges = edge_map.get(node_id, {})
            for port, (src_id, src_port) in node_edges.items():
                src_res = raw_results.get(src_id, {})
                src_val = src_res.get("value")

                actual_val = None
                if isinstance(src_val, dict) and src_port:
                    actual_val = src_val.get(src_port)
                else:
                    actual_val = src_val

                node_resp["inputs"][port] = actual_val

        # Populate outputs
        if node.type in ("function", "sheet", "lut"):
            node_resp["outputs"] = val if val is not None else {}
            # Recursively enrich nested nodes if available (for sheets)
            if node.type == "sheet" and "nodes" in res_data:
                sub_id = node.data.get("sheetId")
                sub_sheet = nested_sheets_map.get(str(sub_id)) if sub_id else None
                if sub_sheet:
                    node_resp["nodes"] = await enrich_results(sub_sheet, res_data["nodes"], db)
                else:
                    # Fallback to raw if sheet definition missing (shouldn't happen)
                    node_resp["nodes"] = res_data["nodes"]
        else:
            node_resp["outputs"] = {"value": val}

        detailed_results[node_id] = serialize_result(node_resp)

    return detailed_results


async def run_calculation(sheet: Sheet, inputs: Dict[str, Dict[str, Any]], db: AsyncSession):
    input_overrides = get_input_overrides(sheet, inputs)

    # Fill in missing inputs from 'example' values in the DB (Standalone defaults)
    # ONLY if the user provided NO inputs at all.
    if not input_overrides:
        for node in sheet.nodes:
            if node.type == "input":
                val = node.data.get("value")
                if val is not None and val != "":
                    input_overrides[str(node.id)] = val

    # Generate script
    generator = CodeGenerator(db)
    script = await generator.generate_full_script(sheet, input_overrides)

    # Execute script
    exec_result = await execute_full_script(script)
    results = exec_result.get("results", {})

    # Build detailed response recursively
    detailed_results = await enrich_results(sheet, results, db)

    # Global script error?
    error = exec_result.get("error") if not exec_result.get("success") else None

    return {"results": detailed_results, "error": error}
