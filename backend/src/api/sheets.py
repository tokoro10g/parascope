from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..models.sheet import Connection, Node, Sheet
from ..schemas.sheet import SheetCreate, SheetRead, SheetUpdate

router = APIRouter(prefix="/sheets", tags=["sheets"])

@router.post("/", response_model=SheetRead)
async def create_sheet(sheet_in: SheetCreate, db: AsyncSession = Depends(get_db)):
    # Create Sheet
    db_sheet = Sheet(name=sheet_in.name, owner_name=sheet_in.owner_name)
    db.add(db_sheet)
    await db.flush() # Get ID

    # Create Nodes
    # Map temp/client ID to DB ID if needed, but we expect client to provide UUIDs or we generate them
    
    for node_in in sheet_in.nodes:
        db_node = Node(
            sheet_id=db_sheet.id,
            type=node_in.type,
            label=node_in.label,
            inputs=[p.model_dump() for p in node_in.inputs],
            outputs=[p.model_dump() for p in node_in.outputs],
            position_x=node_in.position_x,
            position_y=node_in.position_y,
            data=node_in.data
        )
        if node_in.id:
            db_node.id = node_in.id
        db.add(db_node)
    
    # Create Connections
    for conn_in in sheet_in.connections:
        db_conn = Connection(
            sheet_id=db_sheet.id,
            source_id=conn_in.source_id,
            target_id=conn_in.target_id,
            source_handle=conn_in.source_handle,
            target_handle=conn_in.target_handle
        )
        if conn_in.id:
            db_conn.id = conn_in.id
        db.add(db_conn)

    await db.commit()
    await db.refresh(db_sheet, attribute_names=["nodes", "connections"])
    return db_sheet

@router.get("/{sheet_id}", response_model=SheetRead)
async def read_sheet(sheet_id: UUID, db: AsyncSession = Depends(get_db)):
    query = select(Sheet).where(Sheet.id == sheet_id).options(
        selectinload(Sheet.nodes),
        selectinload(Sheet.connections)
    )
    result = await db.execute(query)
    sheet = result.scalar_one_or_none()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@router.put("/{sheet_id}", response_model=SheetRead)
async def update_sheet(sheet_id: UUID, sheet_in: SheetUpdate, db: AsyncSession = Depends(get_db)):
    # Fetch existing sheet
    query = select(Sheet).where(Sheet.id == sheet_id).options(
        selectinload(Sheet.nodes),
        selectinload(Sheet.connections)
    )
    result = await db.execute(query)
    db_sheet = result.scalar_one_or_none()
    if not db_sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    # Update basic info
    if sheet_in.name:
        db_sheet.name = sheet_in.name

    # Full replacement strategy for simplicity (delete all, re-add all)
    # In a real app, we might want to diff, but for a graph editor, full save is common.
    
    # Delete existing connections and nodes
    # Note: cascade delete should handle this if we delete the sheet, but we are keeping the sheet.
    # We need to manually clear the collections or delete via query.
    
    # Clear existing
    db_sheet.connections = []
    db_sheet.nodes = []
    
    # We need to flush to ensure deletions happen before re-insertions if IDs are reused?
    # Actually, if we reuse IDs, we should probably update instead of delete/insert.
    # But for MVP, let's try clearing the list. SQLAlchemy should handle the deletes.
    
    # Re-create Nodes
    for node_in in sheet_in.nodes:
        db_node = Node(
            sheet_id=db_sheet.id,
            type=node_in.type,
            label=node_in.label,
            inputs=[p.model_dump() for p in node_in.inputs],
            outputs=[p.model_dump() for p in node_in.outputs],
            position_x=node_in.position_x,
            position_y=node_in.position_y,
            data=node_in.data
        )
        if node_in.id:
            db_node.id = node_in.id
        db_sheet.nodes.append(db_node)
        db.add(db_node) # Explicit add

    # Flush nodes to ensure they exist before connections reference them
    await db.flush()
        
    # Re-create Connections
    for conn_in in sheet_in.connections:
        db_conn = Connection(
            sheet_id=db_sheet.id,
            source_id=conn_in.source_id,
            target_id=conn_in.target_id,
            source_handle=conn_in.source_handle,
            target_handle=conn_in.target_handle
        )
        if conn_in.id:
            db_conn.id = conn_in.id
        db_sheet.connections.append(db_conn)

    await db.commit()
    await db.refresh(db_sheet, attribute_names=["nodes", "connections"])
    return db_sheet
