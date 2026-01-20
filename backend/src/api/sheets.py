from datetime import datetime, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.auth import get_current_user
from ..core.config import settings
from ..core.database import get_db
from ..models.sheet import AuditLog, Connection, Folder, Lock, Node, Sheet, SheetVersion, UserReadState
from ..schemas.sheet import (
    AuditLogRead,
    FolderCreate,
    FolderRead,
    SheetCreate,
    SheetRead,
    SheetSummary,
    SheetUpdate,
    SheetVersionCreate,
    SheetVersionRead,
    UserReadStateRead,
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


async def _check_for_updates(sheet_id: UUID, user_name: str, db: AsyncSession) -> bool:
    # 1. Get user's last read time for THIS sheet
    read_state_query = select(UserReadState).where(
        UserReadState.sheet_id == sheet_id, UserReadState.user_name == user_name
    )
    res = await db.execute(read_state_query)
    read_state = res.scalar_one_or_none()

    last_read = read_state.last_read_at if read_state else datetime(1970, 1, 1)

    # 2. Check for NEW audit logs in the entire tree
    queue = [sheet_id]
    visited = {sheet_id}

    while queue:
        curr_id = queue.pop(0)

        # Check direct logs
        log_query = (
            select(AuditLog.id)
            .where(AuditLog.sheet_id == curr_id, AuditLog.timestamp > last_read, AuditLog.user_name != user_name)
            .limit(1)
        )
        log_res = await db.execute(log_query)
        if log_res.first():
            return True

        # Find children
        child_query = select(Node.data["sheetId"]).where(Node.sheet_id == curr_id, Node.type == "sheet")
        child_res = await db.execute(child_query)
        for row in child_res.all():
            try:
                child_id = UUID(row[0])
                if child_id not in visited:
                    visited.add(child_id)
                    queue.append(child_id)
            except (ValueError, TypeError):
                continue

    return False


@router.get("/", response_model=list[SheetSummary])
async def list_sheets(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Depends(get_current_user),
):
    query = select(Sheet).offset(skip).limit(limit)
    result = await db.execute(query)
    sheets = result.scalars().all()

    # Enrich with update flag
    summary_list = []
    for s in sheets:
        has_updates = await _check_for_updates(s.id, user_id, db) if user_id else False
        summary = SheetSummary.model_validate(s)
        summary.has_updates = has_updates
        summary_list.append(summary)

    return summary_list


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
async def update_sheet(
    sheet_id: UUID,
    sheet_in: SheetUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    # Fetch existing sheet
    query = (
        select(Sheet).where(Sheet.id == sheet_id).options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
    )
    result = await db.execute(query)
    db_sheet = result.scalar_one_or_none()
    if not db_sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    # Lock Check and Session Update
    if user_id:
        lock_query = select(Lock).where(Lock.sheet_id == sheet_id)
        lock_result = await db.execute(lock_query)
        lock = lock_result.scalar_one_or_none()

        if lock:
            if lock.user_id != user_id:
                # Check if lock is active
                if datetime.utcnow() - lock.last_heartbeat_at <= timedelta(seconds=settings.LOCK_TIMEOUT_SECONDS):
                    raise HTTPException(status_code=403, detail=f"Sheet is locked by {lock.user_id}")
            else:
                # Update last save time
                lock.last_save_at = datetime.utcnow()

    # --- Phase 2: Audit Logging (Diffing) ---
    delta = []
    if sheet_in.nodes is not None:
        old_nodes_by_id = {str(n.id): n for n in db_sheet.nodes}
        new_node_ids = set()

        for node_in in sheet_in.nodes:
            nid_str = str(node_in.id) if node_in.id else None
            if nid_str:
                new_node_ids.add(nid_str)

            if nid_str and nid_str in old_nodes_by_id:
                old_node = old_nodes_by_id[nid_str]
                
                # 1. Label
                if old_node.label != node_in.label:
                    delta.append({
                        "node_id": nid_str,
                        "label": node_in.label,
                        "field": "label",
                        "old": old_node.label,
                        "new": node_in.label
                    })

                # 2. Values & Core Config
                old_data = old_node.data or {}
                new_data = node_in.data or {}
                
                for field in ["value", "code", "lut", "description"]:
                    if old_data.get(field) != new_data.get(field):
                        delta.append({
                            "node_id": nid_str,
                            "label": node_in.label,
                            "field": field,
                            "old": old_data.get(field),
                            "new": new_data.get(field)
                        })
            elif not nid_str:
                # New node (no ID provided yet)
                delta.append({
                    "node_id": None,
                    "label": node_in.label,
                    "field": "node",
                    "old": None,
                    "new": "created"
                })
        
        # 3. Deleted Nodes
        for old_id, old_node in old_nodes_by_id.items():
            if old_id not in new_node_ids:
                delta.append({
                    "node_id": old_id,
                    "label": old_node.label,
                    "field": "node",
                    "old": "existing",
                    "new": "deleted"
                })

    if delta:
        audit_log = AuditLog(
            sheet_id=sheet_id,
            user_name=user_id or "Anonymous",
            delta=delta
        )
        db.add(audit_log)

    # Auto-update read state for the person who saved
    if user_id:
        read_state_stmt = insert(UserReadState).values(
            user_name=user_id,
            sheet_id=sheet_id,
            last_read_at=datetime.utcnow()
        ).on_conflict_do_update(
            index_elements=['user_name', 'sheet_id'],
            set_={'last_read_at': datetime.utcnow()}
        )
        await db.execute(read_state_stmt)
    # ----------------------------------------

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


@router.get("/{sheet_id}/usages")
async def get_sheet_usages(sheet_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Returns a list of 'Root Sheets' that ultimately use this sheet.
    A Root Sheet is an ancestor that has NO 'input' nodes (self-contained simulation).
    Returns the path of node IDs to reach the current sheet instance.
    """
    
    # Queue: (current_sheet_id, list_of_nodes_trace)
    # trace: [NodeInstance_in_Parent, NodeInstance_in_GrandParent...]
    
    queue = [(str(sheet_id), [])]
    valid_roots = []
    visited = set() # (sheet_id) to avoid cycles
    
    while queue:
        curr_id, trace = queue.pop(0)
        
        if curr_id in visited:
            continue
        visited.add(curr_id)
        
        # 1. Find parents (sheets that contain curr_id as a node)
        query = (
            select(Node, Sheet)
            .join(Sheet, Node.sheet_id == Sheet.id)
            .where(
                Node.type == "sheet", 
                Node.data["sheetId"].astext == curr_id
            )
            .options(selectinload(Sheet.nodes)) # Load nodes to check for inputs
        )
        result = await db.execute(query)
        parents = result.all()
        
        for node_instance, parent_sheet in parents:
            # Check if parent has inputs
            has_inputs = any(n.type == 'input' for n in parent_sheet.nodes)
            
            new_trace = [ {"id": str(node_instance.id), "label": node_instance.label} ] + trace
            
            if not has_inputs:
                # Found a root!
                valid_roots.append({
                    "parent_sheet_id": parent_sheet.id,
                    "parent_sheet_name": parent_sheet.name,
                    "node_path": new_trace, # RootInstance -> ... -> LeafInstance
                    "can_import": True
                })
            else:
                # Show direct parents even if they have inputs (but not importable)
                if len(new_trace) == 1:
                    valid_roots.append({
                        "parent_sheet_id": parent_sheet.id,
                        "parent_sheet_name": parent_sheet.name,
                        "node_path": new_trace,
                        "can_import": False
                    })

                if len(new_trace) < 10: # Depth limit
                    queue.append((str(parent_sheet.id), new_trace))
    
    return valid_roots


@router.get("/{sheet_id}/history", response_model=list[AuditLogRead])
async def get_sheet_history(
    sheet_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Depends(get_current_user),
):
    # 1. Get user's last read time
    last_read = datetime(1970, 1, 1)
    if user_id:
        read_state_query = select(UserReadState).where(
            UserReadState.sheet_id == sheet_id, UserReadState.user_name == user_id
        )
        res = await db.execute(read_state_query)
        read_state = res.scalar_one_or_none()
        if read_state:
            last_read = read_state.last_read_at

    # 2. Fetch logs
    query = select(AuditLog).where(AuditLog.sheet_id == sheet_id).order_by(AuditLog.timestamp.desc()).limit(10)
    result = await db.execute(query)
    logs = result.scalars().all()

    # 3. Enrich with is_unread
    enriched_logs = []
    for log in logs:
        is_unread = log.timestamp > last_read and log.user_name != user_id
        enriched_log = AuditLogRead.model_validate(log)
        enriched_log.is_unread = is_unread
        enriched_logs.append(enriched_log)

    return enriched_logs


@router.post("/{sheet_id}/read")
async def mark_sheet_as_read(
    sheet_id: UUID, db: AsyncSession = Depends(get_db), user_id: str = Depends(get_current_user)
):
    if not user_id:
        raise HTTPException(status_code=401, detail="User identity required")

    stmt = (
        insert(UserReadState)
        .values(user_name=user_id, sheet_id=sheet_id, last_read_at=datetime.utcnow())
        .on_conflict_do_update(index_elements=["user_name", "sheet_id"], set_={"last_read_at": datetime.utcnow()})
    )
    await db.execute(stmt)
    await db.commit()
    return {"ok": True}


@router.post("/{sheet_id}/versions", response_model=SheetVersionRead)
async def create_version(
    sheet_id: UUID,
    version_in: SheetVersionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    # Fetch full sheet data
    query = (
        select(Sheet).where(Sheet.id == sheet_id).options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
    )
    result = await db.execute(query)
    sheet = result.scalar_one_or_none()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    # Serialize current state
    # We use a similar format to what the frontend expects
    data = {
        "nodes": [
            {
                "id": str(n.id),
                "type": n.type,
                "label": n.label,
                "inputs": n.inputs,
                "outputs": n.outputs,
                "position_x": n.position_x,
                "position_y": n.position_y,
                "data": n.data,
            }
            for n in sheet.nodes
        ],
        "connections": [
            {
                "id": str(c.id),
                "source_id": str(c.source_id),
                "target_id": str(c.target_id),
                "source_port": c.source_port,
                "target_port": c.target_port,
                "source_handle": c.source_handle,
                "target_handle": c.target_handle,
            }
            for c in sheet.connections
        ],
    }

    db_version = SheetVersion(
        sheet_id=sheet_id,
        version_tag=version_in.version_tag,
        description=version_in.description,
        data=data,
        created_by=user_id or "Anonymous",
    )
    db.add(db_version)
    await db.commit()
    await db.refresh(db_version)
    return db_version


@router.get("/{sheet_id}/versions", response_model=list[SheetVersionRead])
async def list_versions(sheet_id: UUID, db: AsyncSession = Depends(get_db)):
    query = select(SheetVersion).where(SheetVersion.sheet_id == sheet_id).order_by(SheetVersion.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{sheet_id}/versions/{version_id}", response_model=SheetVersionRead)
async def get_version(sheet_id: UUID, version_id: UUID, db: AsyncSession = Depends(get_db)):
    query = select(SheetVersion).where(SheetVersion.id == version_id, SheetVersion.sheet_id == sheet_id)
    result = await db.execute(query)
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version
