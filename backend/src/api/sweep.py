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
    
    input_values = np.linspace(body.start_value, body.end_value, body.steps)

    for val in input_values:
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

    