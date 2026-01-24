import numpy as np
import itertools
from uuid import UUID
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..core.generator import CodeGenerator
from ..core.execution import execute_full_script
from ..models.sheet import Sheet
from ..schemas.sweep import SweepRequest, SweepResponse, SweepHeader


def serialize_result(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, dict):
        # If it's a structured result object { "value": ..., "min": ..., "max": ... }
        # we want to serialize its members but keep it as a dict
        return {k: serialize_result(v) for k, v in val.items()}
    if isinstance(val, list):
        return [serialize_result(v) for v in val]
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return str(val)
    return val

def generate_values(start: str | None, end: str | None, step: str | None, manual: List[str] | None) -> List[Any]:
    if manual is not None:
        return manual
    
    if start is None or end is None or step is None:
        return []

    try:
        start_val = float(start)
        end_val = float(end)
        increment_val = float(step)
    except ValueError:
        raise HTTPException(status_code=400, detail="Start, End, and Increment values must be numeric strings.")

    if increment_val == 0:
        raise HTTPException(status_code=400, detail="Increment cannot be zero.")

    # Determine direction
    if end_val < start_val:
        increment_val = -abs(increment_val)
    else:
        increment_val = abs(increment_val)

    # Calculate number of steps
    num_steps = int(np.floor((end_val - start_val) / increment_val + 1e-10)) + 1
    
    if num_steps <= 0:
        return [start_val]
        
    last_val = start_val + (num_steps - 1) * increment_val
    input_values = np.linspace(start_val, last_val, num_steps)

    if start_val.is_integer() and end_val.is_integer() and increment_val.is_integer():
        input_values = np.round(input_values).astype(int)

    return input_values.tolist()


router = APIRouter(prefix="/sheets", tags=["sweep"])


@router.post("/{sheet_id}/sweep", response_model=SweepResponse)
async def sweep_sheet(
    sheet_id: UUID,
    body: SweepRequest,
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

    # Validate Nodes
    node_map = {str(n.id): n for n in sheet.nodes}
    if str(body.input_node_id) not in node_map:
        raise HTTPException(status_code=400, detail=f"Input node {body.input_node_id} not found in sheet.")
    
    if body.secondary_input_node_id:
        if str(body.secondary_input_node_id) not in node_map:
             raise HTTPException(status_code=400, detail=f"Secondary input node {body.secondary_input_node_id} not found.")
        if str(body.secondary_input_node_id) == str(body.input_node_id):
             raise HTTPException(status_code=400, detail="Primary and Secondary inputs cannot be the same.")

    for out_id in body.output_node_ids:
        if str(out_id) not in node_map:
            raise HTTPException(status_code=400, detail=f"Output node {out_id} not found in sheet.")

    # 1. Generate Values
    primary_values = generate_values(body.start_value, body.end_value, body.increment, body.manual_values)
    secondary_values = []
    if body.secondary_input_node_id:
        secondary_values = generate_values(
            body.secondary_start_value, 
            body.secondary_end_value, 
            body.secondary_increment, 
            body.secondary_manual_values
        )

    if not primary_values:
         raise HTTPException(status_code=400, detail="Primary input range is invalid or empty.")
    if body.secondary_input_node_id and not secondary_values:
         raise HTTPException(status_code=400, detail="Secondary input range is invalid or empty.")

    # 2. Build Scenarios (Cartesian Product)
    scenarios = []
    if body.secondary_input_node_id:
        # 2D Sweep
        # Iterate secondary (outer) then primary (inner) or vice versa. 
        # Typically x (primary) varies faster in plots, so loop y then x.
        # But for ECharts surface, order doesn't matter as long as we define x,y,z.
        for sec_val in secondary_values:
            for prim_val in primary_values:
                scenarios.append({
                    str(body.input_node_id): prim_val,
                    str(body.secondary_input_node_id): sec_val
                })
    else:
        # 1D Sweep
        for prim_val in primary_values:
            scenarios.append({
                str(body.input_node_id): prim_val
            })

    if len(scenarios) > 2000: # Allow slightly more for 2D
        raise HTTPException(status_code=400, detail=f"Sweep generates too many steps ({len(scenarios)}). Limit is 2000.")

    # 3. Prepare Headers
    headers = []
    # Primary Input
    primary_node = node_map[str(body.input_node_id)]
    headers.append(SweepHeader(id=body.input_node_id, label=primary_node.label, type="input"))
    
    # Secondary Input (if exists)
    if body.secondary_input_node_id:
        sec_node = node_map[str(body.secondary_input_node_id)]
        headers.append(SweepHeader(id=body.secondary_input_node_id, label=sec_node.label, type="input"))

    # Outputs
    for oid in body.output_node_ids:
        out_node = node_map[str(oid)]
        headers.append(SweepHeader(id=oid, label=out_node.label, type="output"))

    # 4. Generate & Execute
    generator = CodeGenerator(db)
    static_overrides = {str(k): v for k, v in body.input_overrides.items()}
    output_ids_str = [str(oid) for oid in body.output_node_ids]

    global_error = None
    results_rows: List[List[Any]] = []
    metadata_rows: List[Dict[str, Any]] = []

    try:
        script = await generator.generate_sweep_script(
            root_sheet=sheet,
            scenarios=scenarios,
            static_overrides=static_overrides,
            output_node_ids=output_ids_str
        )
        
        # Extend timeout for 2D sweeps
        timeout = 30.0 + (len(scenarios) * 0.05) 
        exec_result = await execute_full_script(script, timeout=timeout)
        
        if not exec_result.get("success"):
            global_error = exec_result.get("error")

        raw_results = exec_result.get("results", [])
        if not isinstance(raw_results, list):
             raw_results = []
             
        for step in raw_results:
            step_inputs = step.get("inputs", {})
            step_outputs = step.get("outputs", {})
            step_metadata = step.get("metadata", {})
            
            # If the step itself had a top-level error (e.g. timeout or hard crash), ensure it's in metadata
            if "error" in step and "error" not in step_metadata:
                step_metadata["error"] = step["error"]
            
            row = []
            # 1. Primary Input
            row.append(serialize_result(step_inputs.get(str(body.input_node_id))))
            
            # 2. Secondary Input
            if body.secondary_input_node_id:
                row.append(serialize_result(step_inputs.get(str(body.secondary_input_node_id))))
            
            # 3. Outputs
            for oid in output_ids_str:
                row.append(serialize_result(step_outputs.get(oid)))
            
            results_rows.append(row)
            metadata_rows.append(step_metadata)

    except Exception as e:
         global_error = str(e)
         print(f"Sweep generation failed: {e}")

    return SweepResponse(
        headers=headers, 
        results=results_rows, 
        metadata=metadata_rows if metadata_rows else None,
        error=global_error
    )
