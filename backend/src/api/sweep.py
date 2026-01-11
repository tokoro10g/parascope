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
from ..schemas.sweep import SweepRequest, SweepResponse, SweepResultStep


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
    all_node_ids = {str(n.id) for n in sheet.nodes}
    if str(body.input_node_id) not in all_node_ids:
        raise HTTPException(status_code=400, detail=f"Input node {body.input_node_id} not found in sheet.")
    for out_id in body.output_node_ids:
        if str(out_id) not in all_node_ids:
            raise HTTPException(status_code=400, detail=f"Output node {out_id} not found in sheet.")


    sweep_results: List[SweepResultStep] = []
    
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

    # Calculate number of steps: floor((end - start) / inc) + 1
    # Add epsilon to handle floating point inaccuracies
    num_steps = int(np.floor((end_val - start_val) / increment_val + 1e-10)) + 1
    
    if num_steps > 1000:
         raise HTTPException(status_code=400, detail=f"Sweep generates too many steps ({num_steps}). Limit is 1000.")
         
    if num_steps <= 0:
         # Should not happen if logic is correct, but safe fallback
         input_values = np.array([start_val])
    else:
        # Generate values with fixed increment
        # We calculate the exact last value that fits in the range
        last_val = start_val + (num_steps - 1) * increment_val
        input_values = np.linspace(start_val, last_val, num_steps)

    # If inputs are integers, cast the result to integers for cleaner output
    if start_val.is_integer() and end_val.is_integer() and increment_val.is_integer():
        input_values = np.round(input_values).astype(int)

    # Convert numpy array to generic python list for repr() serialization
    input_values_list = input_values.tolist()

    generator = CodeGenerator(db)
    
    # Prepare static overrides
    static_overrides = {str(k): v for k, v in body.input_overrides.items()}
    output_ids_str = [str(oid) for oid in body.output_node_ids]

    try:
        script = await generator.generate_sweep_script(
            root_sheet=sheet,
            input_values=input_values_list,
            input_node_id=str(body.input_node_id),
            static_overrides=static_overrides,
            output_node_ids=output_ids_str
        )
        
        exec_result = execute_full_script(script, timeout=30.0) # Extend timeout for sweeps
        
        results_list = exec_result.get("results", [])
        if not isinstance(results_list, list):
             # Fallback if execution completely failed globally
             results_list = []
             
        for item in results_list:
            step_result = SweepResultStep(
                input_value=serialize_result(item.get("input_value")), 
                outputs=serialize_result(item.get("outputs", {}))
            )
            if "error" in item:
                step_result.error = item["error"]
            sweep_results.append(step_result)

    except Exception as e:
         # Global generation error
         # In a real app we might want to panic better
         print(f"Sweep generation failed: {e}")

    return SweepResponse(results=sweep_results)

    