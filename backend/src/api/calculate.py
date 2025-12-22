from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..core.graph import GraphProcessor
from ..models.sheet import Sheet

router = APIRouter(prefix="/calculate", tags=["calculate"])

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
        processor = GraphProcessor(sheet)
        results = processor.execute(input_overrides=inputs)
        
        # Convert UUID keys to strings for JSON response
        json_results = {str(k): v for k, v in results.items()}
        return json_results
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation failed: {str(e)}") from e
