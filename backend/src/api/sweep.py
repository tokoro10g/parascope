import numpy as np
from uuid import UUID
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..core.graph import GraphProcessor
from ..models.sheet import Sheet
from ..schemas.sweep import SweepRequest, SweepResponse, SweepResultStep

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

    processor = GraphProcessor(sheet, db)
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

    for val in input_values:
        # Merge static overrides with current sweep value
        input_overrides = {str(k): v for k, v in body.input_overrides.items()}
        input_overrides[str(body.input_node_id)] = val
        
        step_result = SweepResultStep(input_value=val, outputs={})

        try:
            script = await processor.generate_script(input_overrides=input_overrides)
            results = await processor.execute_script(script)

            for out_id in body.output_node_ids:
                node_result = results.get(out_id)
                
                if isinstance(node_result, dict):
                    if 'value' in node_result:
                         step_result.outputs[out_id] = node_result['value']
                    else:
                        found_val = None
                        for v in node_result.values():
                            if isinstance(v, (int, float)):
                                found_val = v
                                break
                        step_result.outputs[out_id] = found_val
                else:
                    step_result.outputs[out_id] = node_result
        except Exception as e:
            step_result.error = str(e)

        sweep_results.append(step_result)

    return SweepResponse(results=sweep_results)

    