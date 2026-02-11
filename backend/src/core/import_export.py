import re
import uuid
import yaml
import shutil
import sqlalchemy
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.sheet import Sheet, Node, Connection, SheetVersion
from .config import settings

# Stable namespace for deterministic UUIDs
PARASCOPE_NAMESPACE = uuid.UUID("71ba2025-4a8a-494f-9a8f-fcbae66d2542")

class YAMLNode(BaseModel):
    type: str
    label: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    inputs: Dict[str, str] = Field(default_factory=dict) # target_port: source_node_id.port
    outputs: Optional[List[str]] = None # Explicit output ports
    # Shortcuts
    value: Optional[Any] = None
    code: Optional[str] = None
    sheet_name: Optional[str] = None
    input: Optional[str] = None # Shortcut for single input (e.g. for outputs)
    attachment: Optional[str] = None # Filename relative to preset file or resource dir

class YAMLSheet(BaseModel):
    name: str
    description: Optional[str] = None
    version_tag: Optional[str] = Field(default="1.0", alias="version")
    nodes: Dict[str, YAMLNode]
    
    class Config:
        populate_by_name = True

class SheetImporter:
    def __init__(self, session: AsyncSession, resource_dirs: List[Path] = None):
        self.session = session
        self.sheet_id_cache = {} # name -> id
        self.resource_dirs = resource_dirs or []

    async def _get_sheet_id_by_name(self, name: str) -> uuid.UUID:
        if name in self.sheet_id_cache:
            return self.sheet_id_cache[name]
            
        result = await self.session.execute(select(Sheet).where(Sheet.name == name))
        sheet = result.scalar_one_or_none()
        if not sheet:
            raise ValueError(f"Sheet with name '{name}' not found")
        
        self.sheet_id_cache[name] = sheet.id
        return sheet.id

    async def create_sheet_record(self, yaml_data: Dict[str, Any], folder_id: Optional[uuid.UUID] = None, owner_name: str = "System") -> Sheet:
        yaml_sheet = YAMLSheet(**yaml_data)
        # Deterministic ID based on name
        sheet_id = uuid.uuid5(PARASCOPE_NAMESPACE, yaml_sheet.name)
        sheet = Sheet(
            id=sheet_id,
            name=yaml_sheet.name,
            owner_name=owner_name,
            folder_id=folder_id
        )
        self.session.add(sheet)
        self.sheet_id_cache[yaml_sheet.name] = sheet_id
        return sheet

    async def import_nodes_and_connections(self, sheet: Sheet, yaml_data: Dict[str, Any], base_path: Optional[Path] = None):
        yaml_sheet = YAMLSheet(**yaml_data)
        sheet_id = sheet.id
        
        node_id_map = {} # yaml_id -> db_id
        
        # Column-based layout state
        # Columns: 0 (Inputs/Constants), 1 (Processing), 2 (Outputs)
        grid_size = 20
        col_x = {0: 40, 1: 440, 2: 840}
        col_y = {0: 40, 1: 40, 2: 40}

        # Ensure upload dir exists
        upload_dir = Path(settings.UPLOAD_DIR)
        upload_dir.mkdir(parents=True, exist_ok=True)

        # First pass: Create Nodes
        for yaml_id, node_data in yaml_sheet.nodes.items():
            # Deterministic ID based on sheet and yaml_id
            db_id = uuid.uuid5(sheet_id, yaml_id)
            node_id_map[yaml_id] = db_id

            final_data = node_data.data.copy()
            if node_data.value is not None:
                final_data["value"] = str(node_data.value)
            if node_data.code is not None:
                final_data["code"] = node_data.code.strip()
            if node_data.sheet_name:
                nested_id = await self._get_sheet_id_by_name(node_data.sheet_name)
                final_data["sheetId"] = str(nested_id)

            # Handle Attachment
            if node_data.attachment:
                # Search for attachment
                search_paths = []
                if base_path:
                    search_paths.append(base_path)
                search_paths.extend(self.resource_dirs)

                source_file = None
                for p in search_paths:
                    candidate = p / node_data.attachment
                    if candidate.exists():
                        source_file = candidate
                        break
                
                if source_file:
                    target_name = f"{uuid.uuid4()}_{source_file.name}"
                    shutil.copy(source_file, upload_dir / target_name)
                    final_data["attachment"] = target_name
                    
                    # Append markdown if not already present
                    desc = final_data.get("description", "")
                    if f"![Attachment](/api/v1/attachments/{target_name})" not in desc:
                        final_data["description"] = desc + f"\n\n![Attachment](/api/v1/attachments/{target_name})"
                else:
                    print(f"Warning: Attachment '{node_data.attachment}' not found for node '{yaml_id}'")

            inputs = []
            outputs = []

            # Determine Column and Infer ports
            if node_data.type in ["input", "constant"]:
                outputs = [{"key": "value"}]
                target_col = 0
            elif node_data.type == "output":
                inputs = [{"key": "value"}]
                target_col = 2
            elif node_data.type == "function":
                for port in node_data.inputs.keys():
                    inputs.append({"key": port})
                
                if node_data.outputs is not None:
                    outputs = [{"key": k} for k in node_data.outputs]
                elif "outputs" in final_data:
                    outputs = [{"key": k} for k in final_data["outputs"]]
                elif node_data.code:
                    # Filter out common intermediate variables
                    ignored_vars = {"g0", "math", "np", "pi", "e", "angle_rad"}
                    assignments = re.findall(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*=", node_data.code, re.MULTILINE)
                    unique_outputs = list(dict.fromkeys(assignments))
                    outputs = [{"key": k} for k in unique_outputs if k not in ignored_vars]
                target_col = 1
            elif node_data.type == "lut":
                inputs = [{"key": "key"}]
                if "lut" in final_data and "rows" in final_data["lut"] and len(final_data["lut"]["rows"]) > 0:
                    first_row_values = final_data["lut"]["rows"][0].get("values", {})
                    outputs = [{"key": k} for k in first_row_values.keys()]
                target_col = 1
            elif node_data.type == "sheet":
                for port in node_data.inputs.keys():
                    inputs.append({"key": port})
                if "outputs" in final_data:
                    outputs = [{"key": k} for k in final_data["outputs"]]
                target_col = 1
            else:
                target_col = 1

            pos_x = col_x.get(target_col, 440)
            pos_y = col_y[target_col]
            
            # Estimate height based on port count to prevent overlaps
            port_count = max(len(inputs), len(outputs))
            # Multiples of grid_size (20)
            raw_height = 120 + max(0, port_count - 1) * 40
            estimated_height = ((raw_height + grid_size - 1) // grid_size) * grid_size
            col_y[target_col] += estimated_height + 40 # adding 40px (2 grid cells) gap

            node = Node(
                id=db_id,
                sheet_id=sheet_id,
                type=node_data.type,
                label=node_data.label or yaml_id,
                data=final_data,
                inputs=inputs,
                outputs=outputs,
                position_x=pos_x,
                position_y=pos_y
            )
            self.session.add(node)

        await self.session.flush()

        # Second pass: Connections
        for yaml_id, node_data in yaml_sheet.nodes.items():
            target_node_id = node_id_map[yaml_id]
            
            conns_to_make = node_data.inputs.copy()
            if node_data.input:
                conns_to_make["value"] = node_data.input

            for target_port, source_ref in conns_to_make.items():
                source_yaml_id = None
                source_port = "value"

                # If reference is found directly in node_id_map, it's a node ID
                if source_ref in node_id_map:
                    source_yaml_id = source_ref
                    source_port = "value"
                elif "." in source_ref:
                    # Attempt to split node ID and port name
                    # We iterate from right to left to find the longest matching node ID
                    parts = source_ref.split(".")
                    for i in range(len(parts) - 1, 0, -1):
                        possible_id = ".".join(parts[:i]).strip("\"'")
                        if possible_id in node_id_map:
                            source_yaml_id = possible_id
                            source_port = ".".join(parts[i:]).strip("\"'")
                            break
                    
                    if not source_yaml_id:
                        source_yaml_id = source_ref.strip("\"'")
                        source_port = "value"
                else:
                    source_yaml_id = source_ref.strip("\"'")
                    source_port = "value"

                source_node_id = node_id_map.get(source_yaml_id)
                if source_node_id:
                    # Deterministic ID for connection
                    conn_name = f"{source_node_id}_{source_port}_{target_node_id}_{target_port}"
                    conn_id = uuid.uuid5(sheet_id, conn_name)
                    
                    conn = Connection(
                        id=conn_id,
                        sheet_id=sheet_id,
                        source_id=source_node_id,
                        source_port=source_port,
                        target_id=target_node_id,
                        target_port=target_port
                    )
                    self.session.add(conn)
        
        await self.session.flush()

        # Create Version Snapshot and set as default
        version_id = uuid.uuid4()
        
        nodes_result = await self.session.execute(select(Node).where(Node.sheet_id == sheet_id))
        all_nodes = nodes_result.scalars().all()

        snapshot = {
            "nodes": [
                {
                    "id": str(n.id),
                    "type": n.type,
                    "label": n.label,
                    "position_x": n.position_x,
                    "position_y": n.position_y,
                    "data": n.data,
                    "inputs": n.inputs,
                    "outputs": n.outputs
                } for n in all_nodes
            ],
            "connections": [
                {
                    "id": str(c.id),
                    "source_id": str(c.source_id),
                    "target_id": str(c.target_id),
                    "source_port": c.source_port,
                    "target_port": c.target_port
                } for c in (await self.session.execute(select(Connection).where(Connection.sheet_id == sheet_id))).scalars().all()
            ]
        }
        
        version = SheetVersion(
            id=version_id,
            sheet_id=sheet_id,
            version_tag=yaml_sheet.version_tag,
            description=f"Auto-imported from YAML (v{yaml_sheet.version_tag})",
            data=snapshot,
            created_by="System"
        )
        self.session.add(version)
        
        # Explicitly update the sheet record to ensure default_version_id is saved
        await self.session.execute(
            sqlalchemy.update(Sheet)
            .where(Sheet.id == sheet_id)
            .values(default_version_id=version_id)
        )
        
        await self.session.flush()

    async def import_sheet(self, yaml_data: Dict[str, Any], folder_id: Optional[uuid.UUID] = None, owner_name: str = "System", base_path: Optional[Path] = None) -> Sheet:
        sheet = await self.create_sheet_record(yaml_data, folder_id, owner_name)
        await self.session.flush()
        await self.import_nodes_and_connections(sheet, yaml_data, base_path=base_path)
        return sheet

async def parse_and_import_yaml(session: AsyncSession, content: str, **kwargs) -> Sheet:
    data = yaml.safe_load(content)
    importer = SheetImporter(session)
    return await importer.import_sheet(data, **kwargs)