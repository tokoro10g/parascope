import numpy as np
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
    if isinstance(val, dict):
        return {k: serialize_result(v) for k, v in val.items()}
    if isinstance(val, list):
        return [serialize_result(v) for v in val]
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return str(val)
    return val


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

    # Validate that all requested nodes exist in the sheet
    node_map = {str(n.id): n for n in sheet.nodes}
    if str(body.input_node_id) not in node_map:
        raise HTTPException(status_code=400, detail=f"Input node {body.input_node_id} not found in sheet.")
    for out_id in body.output_node_ids:
        if str(out_id) not in node_map:
            raise HTTPException(status_code=400, detail=f"Output node {out_id} not found in sheet.")

    # Prepare Headers
    headers = []
    # Primary Input Header
    primary_input_node = node_map[str(body.input_node_id)]
    headers.append(SweepHeader(id=body.input_node_id, label=primary_input_node.label, type="input"))
    
    # Output Headers
    for oid in body.output_node_ids:
        out_node = node_map[str(oid)]
        headers.append(SweepHeader(id=oid, label=out_node.label, type="output"))

    if body.manual_values is not None:
        input_values_list = body.manual_values
        if len(input_values_list) > 1000:
            raise HTTPException(status_code=400, detail=f"Sweep generates too many steps ({len(input_values_list)}). Limit is 1000.")
    elif body.start_value is not None and body.end_value is not None and body.increment is not None:
        try:
            start_val = float(body.start_value)
            end_val = float(body.end_value)
            increment_val = float(body.increment)
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
        
        if num_steps > 1000:
            raise HTTPException(status_code=400, detail=f"Sweep generates too many steps ({num_steps}). Limit is 1000.")
            
        if num_steps <= 0:
            input_values = np.array([start_val])
        else:
            last_val = start_val + (num_steps - 1) * increment_val
            input_values = np.linspace(start_val, last_val, num_steps)

        if start_val.is_integer() and end_val.is_integer() and increment_val.is_integer():
            input_values = np.round(input_values).astype(int)

        input_values_list = input_values.tolist()
    else:
        raise HTTPException(status_code=400, detail="Must provide either numeric range (start/end/increment) or manual_values.")

    generator = CodeGenerator(db)
    static_overrides = {str(k): v for k, v in body.input_overrides.items()}
    output_ids_str = [str(oid) for oid in body.output_node_ids]

    global_error = None
    results_rows: List[List[Any]] = []

    try:
        script = await generator.generate_sweep_script(
            root_sheet=sheet,
            input_values=input_values_list,
            input_node_id=str(body.input_node_id),
            static_overrides=static_overrides,
            output_node_ids=output_ids_str
        )
        
        exec_result = execute_full_script(script, timeout=30.0)
        
        if not exec_result.get("success"):
            global_error = exec_result.get("error")

        raw_results = exec_result.get("results", [])
        if not isinstance(raw_results, list):
             raw_results = []
             
        for step in raw_results:
            # Construct a row matching the headers order
            row = []
            # 1. Primary input value
            row.append(serialize_result(step.get("input_value")))
            # 2. Output values
            step_outputs = step.get("outputs", {})
            for oid in output_ids_str:
                row.append(serialize_result(step_outputs.get(oid)))
            
            results_rows.append(row)

    except Exception as e:
         global_error = str(e)
         print(f"Sweep generation failed: {e}")

    return SweepResponse(headers=headers, results=results_rows, error=global_error)