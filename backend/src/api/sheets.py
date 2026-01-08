from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.sheet import Connection, Folder, Node, Sheet
from ..schemas.sheet import (
    FolderCreate,
    FolderRead,
    SheetCreate,
    SheetRead,
    SheetSummary,
    SheetUpdate,
)

router = APIRouter(prefix="/sheets", tags=["sheets"])


def _sort_nodes(sheet: Sheet) -> Sheet:
    if sheet.nodes:
        # Sort by X then Y to match frontend table view
        sheet.nodes.sort(key=lambda n: (n.position_x, n.position_y))
    return sheet


@router.post("/folders", response_model=FolderRead)
async def create_folder(folder_in: FolderCreate, db: AsyncSession = Depends(get_db)):
    db_folder = Folder(name=folder_in.name, parent_id=folder_in.parent_id)
    db.add(db_folder)
    await db.commit()
    await db.refresh(db_folder)
    return db_folder


@router.get("/folders", response_model=list[FolderRead])
async def list_folders(db: AsyncSession = Depends(get_db)):
    query = select(Folder)
    result = await db.execute(query)
    return result.scalars().all()


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: UUID, db: AsyncSession = Depends(get_db)):
    query = select(Folder).where(Folder.id == folder_id)
    result = await db.execute(query)
    folder = result.scalar_one_or_none()

    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Move sheets to parent
    stmt = update(Sheet).where(Sheet.folder_id == folder_id).values(folder_id=folder.parent_id)
    await db.execute(stmt)

    await db.delete(folder)
    await db.commit()
    return {"ok": True}


@router.get("/", response_model=list[SheetSummary])
async def list_sheets(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    query = select(Sheet).offset(skip).limit(limit)
    result = await db.execute(query)
    sheets = result.scalars().all()
    return sheets


@router.post("/", response_model=SheetRead)
async def create_sheet(
    sheet_in: SheetCreate, db: AsyncSession = Depends(get_db), current_user: str | None = Depends(get_current_user)
):
    # Create Sheet
    owner = current_user if current_user else sheet_in.owner_name
    db_sheet = Sheet(name=sheet_in.name, owner_name=owner, folder_id=sheet_in.folder_id)
    db.add(db_sheet)
    await db.flush()  # Get ID

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
            data=node_in.data,
        )
        if node_in.id:
            db_node.id = node_in.id
        db.add(db_node)

    await db.flush()

    # Create Connections
    for conn_in in sheet_in.connections:
        db_conn = Connection(
            sheet_id=db_sheet.id,
            source_id=conn_in.source_id,
            target_id=conn_in.target_id,
            source_port=conn_in.source_port,
            target_port=conn_in.target_port,
            source_handle=conn_in.source_handle,
            target_handle=conn_in.target_handle,
        )
        if conn_in.id:
            db_conn.id = conn_in.id
        db.add(db_conn)

    await db.commit()
    await db.refresh(db_sheet, attribute_names=["nodes", "connections"])
    return _sort_nodes(db_sheet)


@router.get("/{sheet_id}", response_model=SheetRead)
async def read_sheet(sheet_id: UUID, db: AsyncSession = Depends(get_db)):
    query = (
        select(Sheet).where(Sheet.id == sheet_id).options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
    )
    result = await db.execute(query)
    sheet = result.scalar_one_or_none()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return _sort_nodes(sheet)


@router.put("/{sheet_id}", response_model=SheetRead)
async def update_sheet(sheet_id: UUID, sheet_in: SheetUpdate, db: AsyncSession = Depends(get_db)):
    # Fetch existing sheet
    query = (
        select(Sheet).where(Sheet.id == sheet_id).options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
    )
    result = await db.execute(query)
    db_sheet = result.scalar_one_or_none()
    if not db_sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    # Update basic info
    update_data = sheet_in.model_dump(exclude_unset=True)
    if "name" in update_data:
        db_sheet.name = update_data["name"]
    if "folder_id" in update_data:
        db_sheet.folder_id = update_data["folder_id"]

    # Full replacement strategy for simplicity (delete all, re-add all)
    # In a real app, we might want to diff, but for a graph editor, full save is common.

    if sheet_in.nodes is not None:
        # Clear existing
        db_sheet.connections = []  # Clear connections first to avoid FK issues if we clear nodes
        db_sheet.nodes = []

        # Re-create Nodes
        for node_in in sheet_in.nodes:
            if node_in.type in ('input', 'function', 'sheet'):
                if 'value' in node_in.data:
                    node_in.data.pop('value')
            db_node = Node(
                sheet_id=db_sheet.id,
                type=node_in.type,
                label=node_in.label,
                inputs=[p.model_dump() for p in node_in.inputs],
                outputs=[p.model_dump() for p in node_in.outputs],
                position_x=node_in.position_x,
                position_y=node_in.position_y,
                data=node_in.data,
            )
            if node_in.id:
                db_node.id = node_in.id
            db_sheet.nodes.append(db_node)
            db.add(db_node)  # Explicit add

        # Flush nodes to ensure they exist before connections reference them
        await db.flush()

    if sheet_in.connections is not None:
        # If we didn't clear connections above (because nodes were None), clear them now
        if sheet_in.nodes is None:
            db_sheet.connections = []

        # Re-create Connections
        for conn_in in sheet_in.connections:
            db_conn = Connection(
                sheet_id=db_sheet.id,
                source_id=conn_in.source_id,
                target_id=conn_in.target_id,
                source_port=conn_in.source_port,
                target_port=conn_in.target_port,
                source_handle=conn_in.source_handle,
                target_handle=conn_in.target_handle,
            )
            db.add(db_conn)
    await db.commit()
    await db.refresh(db_sheet, attribute_names=["nodes", "connections"])
    return _sort_nodes(db_sheet)


@router.post("/{sheet_id}/duplicate", response_model=SheetRead)
async def duplicate_sheet(sheet_id: UUID, db: AsyncSession = Depends(get_db)):
    # Fetch source sheet
    query = (
        select(Sheet).where(Sheet.id == sheet_id).options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
    )
    result = await db.execute(query)
    source_sheet = result.scalar_one_or_none()
    if not source_sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    # Create new sheet
    new_sheet = Sheet(
        name=f"{source_sheet.name} (Copy)", owner_name=source_sheet.owner_name, folder_id=source_sheet.folder_id
    )
    db.add(new_sheet)
    await db.flush()

    # Map old node IDs to new node IDs
    node_id_map = {}

    # Duplicate Nodes
    for node in source_sheet.nodes:
        new_node_id = uuid4()
        node_id_map[node.id] = new_node_id

        new_node = Node(
            id=new_node_id,
            sheet_id=new_sheet.id,
            type=node.type,
            label=node.label,
            inputs=node.inputs,
            outputs=node.outputs,
            position_x=node.position_x,
            position_y=node.position_y,
            data=node.data,
        )
        db.add(new_node)

    await db.flush()

    # Duplicate Connections
    for conn in source_sheet.connections:
        # Ensure both source and target nodes exist in the map
        if conn.source_id in node_id_map and conn.target_id in node_id_map:
            new_conn = Connection(
                sheet_id=new_sheet.id,
                source_id=node_id_map[conn.source_id],
                target_id=node_id_map[conn.target_id],
                source_port=conn.source_port,
                target_port=conn.target_port,
                source_handle=conn.source_handle,
                target_handle=conn.target_handle,
            )
            db.add(new_conn)

    await db.commit()
    await db.refresh(new_sheet, attribute_names=["nodes", "connections"])
    return _sort_nodes(new_sheet)


@router.delete("/{sheet_id}", status_code=204)
async def delete_sheet(sheet_id: UUID, db: AsyncSession = Depends(get_db)):
    # Check if sheet is used in other sheets
    query_deps = select(Sheet).join(Node).where(Node.type == "sheet", Node.data["sheetId"].astext == str(sheet_id))
    result_deps = await db.execute(query_deps)
    parent_sheet = result_deps.scalars().first()

    if parent_sheet:
        raise HTTPException(status_code=400, detail=f"Cannot delete sheet. It is used in '{parent_sheet.name}'")

    query = select(Sheet).where(Sheet.id == sheet_id)
    result = await db.execute(query)
    sheet = result.scalar_one_or_none()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    await db.delete(sheet)
    await db.commit()
    return None
