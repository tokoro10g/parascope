from datetime import datetime, timedelta
from typing import Any, Dict
from uuid import UUID, uuid4

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import PlainTextResponse
from sqlalchemy import or_, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer, selectinload

from ..core.auth import get_current_user
from ..core.calculation_service import run_calculation
from ..core.config import settings
from ..core.database import get_db
from ..core.generator import CodeGenerator
from ..models.sheet import (
    AuditLog,
    Connection,
    Folder,
    Node,
    Sheet,
    SheetLock,
    SheetVersion,
    UserReadState,
    make_aware,
    utcnow,
)
from ..schemas.sheet import (
    AuditLogRead,
    FolderCreate,
    FolderRead,
    FolderUpdate,
    SheetCreate,
    SheetRead,
    SheetSummary,
    SheetUpdate,
    SheetVersionCreate,
    SheetVersionRead,
    SheetVersionSummary,
)
from .calculate import PreviewRequest, construct_sheet

router = APIRouter(prefix="/sheets", tags=["sheets"])


async def _enrich_nodes_with_external_data(sheet: Sheet, db: AsyncSession):
    if not sheet.nodes:
        return

    version_ids = []
    sheet_ids = []
    for node in sheet.nodes:
        if node.type == "sheet":
            vid = node.data.get("versionId")
            if vid:
                try:
                    version_ids.append(UUID(vid))
                except ValueError:
                    pass
            sid = node.data.get("sheetId")
            if sid:
                try:
                    sheet_ids.append(UUID(sid))
                except ValueError:
                    pass

    # 1. Enrich Version Tags
    version_map = {}
    if version_ids:
        query = select(SheetVersion.id, SheetVersion.version_tag).where(SheetVersion.id.in_(version_ids))
        result = await db.execute(query)
        version_map = {str(row.id): row.version_tag for row in result.all()}

    # 2. Enrich Sheet Labels (Sync name) and Default Version IDs
    sheet_info_map = {}
    if sheet_ids:
        query = select(Sheet.id, Sheet.name, Sheet.default_version_id, Sheet.owner_name).where(Sheet.id.in_(sheet_ids))
        result = await db.execute(query)
        for row in result.all():
            sheet_info_map[str(row.id)] = {
                "name": row.name,
                "default_version_id": str(row.default_version_id) if row.default_version_id else None,
                "owner_name": row.owner_name,
            }

    # Update node data and label
    for node in sheet.nodes:
        if node.type == "sheet":
            sid = node.data.get("sheetId")
            if sid and sid in sheet_info_map:
                node.label = sheet_info_map[sid]["name"]

                new_data = dict(node.data)
                new_data["defaultVersionId"] = sheet_info_map[sid]["default_version_id"]
                new_data["ownerName"] = sheet_info_map[sid]["owner_name"]

                vid = node.data.get("versionId")
                if vid and vid in version_map:
                    new_data["versionTag"] = version_map[vid]

                node.data = new_data


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


@router.put("/folders/{folder_id}", response_model=FolderRead)
async def update_folder(folder_id: UUID, folder_in: FolderUpdate, db: AsyncSession = Depends(get_db)):
    query = select(Folder).where(Folder.id == folder_id)
    result = await db.execute(query)
    folder = result.scalar_one_or_none()

    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    update_data = folder_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(folder, key, value)

    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return folder


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
    limit: int = 1000,
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
        # data is a Pydantic model (via Union), so we must dump it to a dict/json
        # explicitly before passing to SQLAlchemy JSONB column.
        node_data = node_in.data.model_dump(mode="json") if hasattr(node_in.data, "model_dump") else node_in.data

        db_node = Node(
            sheet_id=db_sheet.id,
            type=node_in.type,
            label=node_in.label,
            inputs=[p.model_dump() for p in node_in.inputs],
            outputs=[p.model_dump() for p in node_in.outputs],
            position_x=node_in.position_x,
            position_y=node_in.position_y,
            data=node_data,
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
        )
        if conn_in.id:
            db_conn.id = conn_in.id
        db.add(db_conn)

    await db.commit()
    await db.refresh(db_sheet, attribute_names=["nodes", "connections"])
    await _enrich_nodes_with_external_data(db_sheet, db)
    return db_sheet


@router.get("/{sheet_id}", response_model=SheetRead)
async def read_sheet(sheet_id: UUID, db: AsyncSession = Depends(get_db)):
    query = (
        select(Sheet).where(Sheet.id == sheet_id).options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
    )
    result = await db.execute(query)
    sheet = result.scalar_one_or_none()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    await _enrich_nodes_with_external_data(sheet, db)
    return sheet


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
        lock_query = select(SheetLock).where(SheetLock.sheet_id == sheet_id)
        lock_result = await db.execute(lock_query)
        lock = lock_result.scalar_one_or_none()

        if lock:
            if lock.user_id != user_id:
                # Check if lock is active
                if utcnow() - lock.last_heartbeat_at <= timedelta(seconds=settings.LOCK_TIMEOUT_SECONDS):
                    raise HTTPException(status_code=403, detail=f"Sheet is locked by {lock.user_id}")
            else:
                # Update last save time
                lock.last_save_at = utcnow()

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
                    delta.append(
                        {
                            "node_id": nid_str,
                            "label": node_in.label,
                            "field": "label",
                            "old": old_node.label,
                            "new": node_in.label,
                        }
                    )

                # 2. Values & Core Config
                old_data = old_node.data or {}
                # node_in.data might be a Pydantic model or dict
                new_data = (
                    node_in.data.model_dump(mode="json")
                    if hasattr(node_in.data, "model_dump")
                    else (node_in.data or {})
                )

                for field in ["value", "code", "lut", "description"]:
                    if old_data.get(field) != new_data.get(field):
                        delta.append(
                            {
                                "node_id": nid_str,
                                "label": node_in.label,
                                "field": field,
                                "old": old_data.get(field),
                                "new": new_data.get(field),
                            }
                        )
            elif not nid_str:
                # New node (no ID provided yet)
                delta.append({"node_id": None, "label": node_in.label, "field": "node", "old": None, "new": "created"})

        # 3. Deleted Nodes
        for old_id, old_node in old_nodes_by_id.items():
            if old_id not in new_node_ids:
                delta.append(
                    {"node_id": old_id, "label": old_node.label, "field": "node", "old": "existing", "new": "deleted"}
                )

    if delta:
        audit_log = AuditLog(sheet_id=sheet_id, user_name=user_id or "Anonymous", delta=delta)
        db.add(audit_log)

    # Auto-update read state for the person who saved
    if user_id:
        read_state_stmt = (
            insert(UserReadState)
            .values(user_name=user_id, sheet_id=sheet_id, last_read_at=utcnow())
            .on_conflict_do_update(index_elements=["user_name", "sheet_id"], set_={"last_read_at": utcnow()})
        )
        await db.execute(read_state_stmt)
    # ----------------------------------------

    # Update basic info
    update_data = sheet_in.model_dump(exclude_unset=True)
    if "name" in update_data:
        db_sheet.name = update_data["name"]
    if "folder_id" in update_data:
        db_sheet.folder_id = update_data["folder_id"]
    if "default_version_id" in update_data:
        db_sheet.default_version_id = update_data["default_version_id"]

    # Full replacement strategy for simplicity (delete all, re-add all)
    # In a real app, we might want to diff, but for a graph editor, full save is common.

    if sheet_in.nodes is not None:
        # Clear existing
        db_sheet.connections = []  # Clear connections first to avoid FK issues if we clear nodes
        db_sheet.nodes = []

        # Re-create Nodes
        for node_in in sheet_in.nodes:
            # Handle data serialization for Pydantic models in Union
            node_data = node_in.data.model_dump(mode="json") if hasattr(node_in.data, "model_dump") else node_in.data

            if node_in.type in ("function", "sheet"):
                if "value" in node_data:
                    node_data.pop("value")

            db_node = Node(
                sheet_id=db_sheet.id,
                type=node_in.type,
                label=node_in.label,
                inputs=[p.model_dump() for p in node_in.inputs],
                outputs=[p.model_dump() for p in node_in.outputs],
                position_x=node_in.position_x,
                position_y=node_in.position_y,
                data=node_data,
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

        for conn_in in sheet_in.connections:
            db_conn = Connection(
                sheet_id=db_sheet.id,
                source_id=conn_in.source_id,
                target_id=conn_in.target_id,
                source_port=conn_in.source_port,
                target_port=conn_in.target_port,
            )
            db.add(db_conn)

    await db.commit()
    await db.refresh(db_sheet, attribute_names=["nodes", "connections"])
    await _enrich_nodes_with_external_data(db_sheet, db)
    return db_sheet


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
            )
            db.add(new_conn)

    await db.commit()
    await db.refresh(new_sheet, attribute_names=["nodes", "connections"])
    await _enrich_nodes_with_external_data(new_sheet, db)
    return new_sheet


@router.delete("/{sheet_id}")
async def delete_sheet(sheet_id: UUID, db: AsyncSession = Depends(get_db)):
    sheet = await db.get(Sheet, sheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    await db.delete(sheet)
    await db.commit()
    return {"ok": True}


@router.get("/{sheet_id}/script", response_class=PlainTextResponse)
async def generate_script_sheet(
    sheet_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Sheet).where(Sheet.id == sheet_id).options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
    )
    result = await db.execute(query)
    sheet = result.scalar_one_or_none()

    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    input_overrides = {}
    generator = CodeGenerator(db)
    script = await generator.generate_full_script(sheet, input_overrides)
    return script


@router.post("/{sheet_id}/calculate")
async def calculate_sheet(
    sheet_id: UUID,
    version_id: UUID | None = None,
    inputs: Dict[str, Dict[str, Any]] = Body(None),
    db: AsyncSession = Depends(get_db),
):
    if inputs is None:
        inputs = {}

    if version_id:
        # 1. Fetch Version
        v_query = select(SheetVersion).where(SheetVersion.id == version_id, SheetVersion.sheet_id == sheet_id)
        v_res = await db.execute(v_query)
        version = v_res.scalar_one_or_none()
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")

        # 2. Construct transient Sheet object for runner
        # We wrap data in a PreviewRequest-like structure to reuse _construct_sheet
        mock_body = PreviewRequest(
            graph={"name": "Snapshot", "nodes": version.data["nodes"], "connections": version.data["connections"]},
            inputs=inputs,
        )
        sheet = await run_in_threadpool(construct_sheet, mock_body)
    else:
        # Default: Calculate Draft
        query = (
            select(Sheet)
            .where(Sheet.id == sheet_id)
            .options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
        )
        result = await db.execute(query)
        sheet = result.scalar_one_or_none()

        if not sheet:
            raise HTTPException(status_code=404, detail="Sheet not found")

    return await run_calculation(sheet, inputs, db)


@router.get("/{sheet_id}/usages")
async def get_sheet_usages(sheet_id: UUID, version_id: UUID | None = None, db: AsyncSession = Depends(get_db)):
    """
    Returns a list of 'Root Sheets' that ultimately use this sheet.
    A Root Sheet is an ancestor that has NO 'input' nodes (self-contained simulation).
    If version_id is provided, searches for usages of that specific version.
    If version_id is None, searches for usages of the 'Draft' version.
    Returns the path of node IDs to reach the current sheet instance.
    Includes usages found in parent Drafts AND parent Snapshots (Versions).
    """

    # Queue: (current_sheet_id, current_version_id, list_of_nodes_trace)
    # trace: [NodeInstance_in_Parent, NodeInstance_in_GrandParent...]

    queue = [(str(sheet_id), str(version_id) if version_id else None, [])]
    valid_roots = []
    visited = set()  # (sheet_id, version_id) to avoid cycles

    while queue:
        curr_id, curr_vid, trace = queue.pop(0)

        if (curr_id, curr_vid) in visited:
            continue
        visited.add((curr_id, curr_vid))

        # --- 1. Find parents in DRAFTS (Node table) ---
        query_drafts = (
            select(Node, Sheet)
            .join(Sheet, Node.sheet_id == Sheet.id)
            .where(Node.type == "sheet", Node.data["sheetId"].astext == str(curr_id))
            .options(selectinload(Sheet.nodes))
        )

        if curr_vid:
            query_drafts = query_drafts.where(Node.data["versionId"].astext == str(curr_vid))
        else:
            query_drafts = query_drafts.where(
                or_(Node.data["versionId"].astext.is_(None), Node.data["versionId"].astext == "")
            )

        result_drafts = await db.execute(query_drafts)
        for node_instance, parent_sheet in result_drafts.all():
            has_inputs = any(n.type == "input" for n in parent_sheet.nodes)
            new_trace = [{"id": str(node_instance.id), "label": node_instance.label}] + trace

            usage_info = {
                "parent_sheet_id": parent_sheet.id,
                "parent_sheet_name": parent_sheet.name,
                "parent_version_id": None,
                "parent_version_tag": "Draft",
                "node_path": new_trace,
                "can_import": not has_inputs,
            }

            if not has_inputs or len(new_trace) == 1:
                valid_roots.append(usage_info)

            if has_inputs and len(new_trace) < 10:
                queue.append((str(parent_sheet.id), None, new_trace))

        # --- 2. Find parents in SNAPSHOTS (SheetVersion table) ---
        # We use a raw SQL approach for complex JSONB search to be efficient
        # Search for: nodes that have type='sheet' and data.sheetId = curr_id and data.versionId = curr_vid

        version_sql = text(
            """
            SELECT sv.id, sv.sheet_id, s.name, sv.version_tag, node->>'id' as node_id, node->>'label' as node_label,
              sv.data->'nodes' as all_nodes
            FROM sheet_versions sv
            JOIN sheets s ON s.id = sv.sheet_id,
            jsonb_array_elements(sv.data->'nodes') AS node
            WHERE node->>'type' = 'sheet'
              AND node->'data'->>'sheetId' = :sheet_id
              AND (
                (CAST(:version_id AS TEXT) IS NULL
                  AND (node->'data'->'versionId' IS NULL OR node->'data'->>'versionId' = ''))
                OR (node->'data'->>'versionId' = CAST(:version_id AS TEXT))
              )
        """
        )

        v_result = await db.execute(version_sql, {"sheet_id": curr_id, "version_id": curr_vid})
        for v_id, s_id, s_name, v_tag, n_id, n_label, all_nodes in v_result.all():
            # Check if this snapshot had inputs
            has_inputs = any(n.get("type") == "input" for n in all_nodes)
            new_trace = [{"id": n_id, "label": n_label}] + trace

            usage_info = {
                "parent_sheet_id": s_id,
                "parent_sheet_name": s_name,
                "parent_version_id": v_id,
                "parent_version_tag": v_tag,
                "node_path": new_trace,
                "can_import": not has_inputs,
            }

            if not has_inputs or len(new_trace) == 1:
                valid_roots.append(usage_info)

            if has_inputs and len(new_trace) < 10:
                queue.append((str(s_id), str(v_id), new_trace))

    return valid_roots


@router.get("/{sheet_id}/history", response_model=list[AuditLogRead])
async def get_sheet_history(
    sheet_id: UUID,
    before_timestamp: datetime | None = None,
    after_timestamp: datetime | None = None,
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
    query = select(AuditLog).where(AuditLog.sheet_id == sheet_id)

    if before_timestamp:
        query = query.where(AuditLog.timestamp <= before_timestamp)
    if after_timestamp:
        query = query.where(AuditLog.timestamp >= after_timestamp)

    query = query.order_by(AuditLog.timestamp.desc()).limit(10)
    result = await db.execute(query)
    logs = result.scalars().all()

    # 3. Enrich with is_unread
    enriched_logs = []
    for log in logs:
        is_unread = make_aware(log.timestamp) > make_aware(last_read) and log.user_name != user_id
        enriched_log = AuditLogRead.model_validate(log)
        enriched_log.timestamp = make_aware(log.timestamp)
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
        .values(user_name=user_id, sheet_id=sheet_id, last_read_at=utcnow())
        .on_conflict_do_update(index_elements=["user_name", "sheet_id"], set_={"last_read_at": utcnow()})
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

    await _enrich_nodes_with_external_data(sheet, db)

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
    await db.flush()  # Get version ID

    # Automatically set as default
    sheet.default_version_id = db_version.id

    await db.commit()
    await db.refresh(db_version)
    return db_version


@router.get("/{sheet_id}/versions", response_model=list[SheetVersionSummary])
async def list_versions(sheet_id: UUID, db: AsyncSession = Depends(get_db)):
    query = (
        select(SheetVersion)
        .where(SheetVersion.sheet_id == sheet_id)
        .order_by(SheetVersion.created_at.desc())
        .options(defer(SheetVersion.data))
    )
    result = await db.execute(query)
    versions = result.scalars().all()
    for v in versions:
        v.created_at = make_aware(v.created_at)
    return versions


@router.get("/{sheet_id}/versions/{version_id}", response_model=SheetVersionRead)
async def get_version(sheet_id: UUID, version_id: UUID, db: AsyncSession = Depends(get_db)):
    query = select(SheetVersion).where(SheetVersion.id == version_id, SheetVersion.sheet_id == sheet_id)
    result = await db.execute(query)
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Enrich labels and version tags
    # We create temporary Node objects to use _enrich_nodes_with_external_data
    temp_nodes = []
    original_nodes = version.data.get("nodes", [])
    for n in original_nodes:
        temp_nodes.append(
            Node(
                id=UUID(n["id"]),
                type=n["type"],
                label=n["label"],
                inputs=n["inputs"],
                outputs=n["outputs"],
                data=n["data"],
            )
        )
    temp_sheet = Sheet(nodes=temp_nodes)
    await _enrich_nodes_with_external_data(temp_sheet, db)

    # Update version.data with enriched nodes while preserving positions
    new_nodes = []
    for i, n in enumerate(temp_sheet.nodes):
        enriched_node = original_nodes[i].copy()
        enriched_node["label"] = n.label
        enriched_node["data"] = n.data
        new_nodes.append(enriched_node)

    version.data = {
        "nodes": new_nodes,
        "connections": version.data.get("connections", []),
    }

    version.created_at = make_aware(version.created_at)
    return version


@router.delete("/{sheet_id}/versions/{version_id}")
async def delete_version(sheet_id: UUID, version_id: UUID, db: AsyncSession = Depends(get_db)):
    # 1. Verify existence and sheet_id match
    query = select(SheetVersion).where(SheetVersion.id == version_id, SheetVersion.sheet_id == sheet_id)
    result = await db.execute(query)
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # 2. Prevent deleting default version
    sheet_query = select(Sheet).where(Sheet.id == sheet_id)
    sheet_result = await db.execute(sheet_query)
    sheet = sheet_result.scalar_one_or_none()
    if sheet and sheet.default_version_id == version_id:
        raise HTTPException(
            status_code=400, detail="Cannot delete the default version. Set another version as default first."
        )

    # 3. Delete
    await db.delete(version)
    await db.commit()
    return {"message": "Version deleted successfully"}
