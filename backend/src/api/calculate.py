import traceback
from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..core.graph import GraphProcessor
from ..core.exceptions import NodeExecutionError
from ..core.units import ureg
from ..models.sheet import Sheet

router = APIRouter(prefix="/calculate", tags=["calculate"])

def serialize_result(val: Any) -> Any:
    # Check for pint Quantity using duck typing to handle multiprocessing/pickling issues
    # where the class might not match the local ureg.Quantity
    if hasattr(val, 'magnitude') and hasattr(val, 'units') and val.__class__.__name__ == 'Quantity':
        return {"val": val.magnitude, "unit": f"{val.units:~P}"}
    if isinstance(val, dict):
        return {k: serialize_result(v) for k, v in val.items()}
    if isinstance(val, list):
        return [serialize_result(v) for v in val]
    return val

@router.post("/{sheet_id}")
async def calculate_sheet(sheet_id: UUID, inputs: Dict[str, Any] = None, db: AsyncSession = Depends(get_db)):
    if inputs is None:
        inputs = {}
    # Load sheet with all relations
    query = select(Sheet).where(Sheet.id == sheet_id).options(
        selectinload(Sheet.nodes),
        selectinload(Sheet.connections)
    )
    result = await db.execute(query)
    sheet = result.scalar_one_or_none()
    
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    try:
        processor = GraphProcessor(sheet, db)
        results = await processor.execute(input_overrides=inputs)
        
        # Convert UUID keys to strings for JSON response and serialize units
        json_results = {str(k): serialize_result(v) for k, v in results.items()}
        return json_results
        
    except NodeExecutionError as e:
        print("Node execution error:", e, flush=True)
        raise HTTPException(status_code=400, detail={
            "message": str(e),
            "node_id": e.node_id,
            "error": e.error_message
        }) from e
    except ValueError as e:
        print("Value error:", e, flush=True)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        print("Unexpected error:", e, flush=True)
        raise HTTPException(status_code=500, detail=f"Calculation failed: {str(e) + traceback.format_exc()}") from e
