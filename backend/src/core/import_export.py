import re
import uuid
import yaml
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.sheet import Sheet, Node, Connection

class YAMLNode(BaseModel):
    type: str
    label: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    inputs: Dict[str, str] = Field(default_factory=dict) # target_port: source_node_id.port
    # Shortcuts
    value: Optional[Any] = None
    code: Optional[str] = None
    sheet_name: Optional[str] = None
    input: Optional[str] = None # Shortcut for single input (e.g. for outputs)

class YAMLSheet(BaseModel):
    name: str
    description: Optional[str] = None
    nodes: Dict[str, YAMLNode]

class SheetImporter:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _get_sheet_id_by_name(self, name: str) -> uuid.UUID:
        result = await self.session.execute(select(Sheet).where(Sheet.name == name))
        sheet = result.scalar_one_or_none()
        if not sheet:
            raise ValueError(f"Sheet with name '{name}' not found")
        return sheet.id

    async def import_sheet(self, yaml_data: Dict[str, Any], folder_id: Optional[uuid.UUID] = None, owner_name: str = "System") -> Sheet:
        yaml_sheet = YAMLSheet(**yaml_data)
        sheet_id = uuid.uuid4()
        sheet = Sheet(
            id=sheet_id,
            name=yaml_sheet.name,
            owner_name=owner_name,
            folder_id=folder_id
        )
        self.session.add(sheet)

        node_id_map = {} # yaml_id -> db_id
        current_y = 50

        # First pass: Create Nodes
        for yaml_id, node_data in yaml_sheet.nodes.items():
            db_id = uuid.uuid4()
            node_id_map[yaml_id] = db_id

            final_data = node_data.data.copy()
            if node_data.value is not None:
                final_data["value"] = str(node_data.value)
            if node_data.code is not None:
                final_data["code"] = node_data.code.strip()
            if node_data.sheet_name:
                nested_id = await self._get_sheet_id_by_name(node_data.sheet_name)
                final_data["sheetId"] = str(nested_id)

            inputs = []
            outputs = []

            # Infer ports
            if node_data.type in ["input", "constant"]:
                outputs = [{"key": "value"}]
                pos_x = 100
            elif node_data.type == "output":
                inputs = [{"key": "value"}]
                pos_x = 1000
            elif node_data.type == "function":
                for port in node_data.inputs.keys():
                    inputs.append({"key": port})
                if "outputs" in final_data:
                    outputs = [{"key": k} for k in final_data["outputs"]]
                elif node_data.code:
                    assignments = re.findall(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*=", node_data.code, re.MULTILINE)
                    unique_outputs = list(dict.fromkeys(assignments))
                    outputs = [{"key": k} for k in unique_outputs]
                pos_x = 500
            elif node_data.type == "lut":
                inputs = [{"key": "key"}]
                if "lut" in final_data and "rows" in final_data["lut"] and len(final_data["lut"]["rows"]) > 0:
                    first_row_values = final_data["lut"]["rows"][0].get("values", {})
                    outputs = [{"key": k} for k in first_row_values.keys()]
                pos_x = 400
            elif node_data.type == "sheet":
                # For sheets, we just take what's in inputs or infer from connections
                for port in node_data.inputs.keys():
                    inputs.append({"key": port})
                if "outputs" in final_data:
                    outputs = [{"key": k} for k in final_data["outputs"]]
                pos_x = 500
            else:
                pos_x = 300

            node = Node(
                id=db_id,
                sheet_id=sheet_id,
                type=node_data.type,
                label=node_data.label or yaml_id,
                data=final_data,
                inputs=inputs,
                outputs=outputs,
                position_x=pos_x,
                position_y=current_y
            )
            current_y += 150
            self.session.add(node)

        await self.session.flush()

        # Second pass: Connections
        for yaml_id, node_data in yaml_sheet.nodes.items():
            target_node_id = node_id_map[yaml_id]
            
            conns = node_data.inputs.copy()
            if node_data.input:
                conns["value"] = node_data.input

            for target_port, source_ref in conns.items():
                if source_ref in node_id_map:
                    source_yaml_id = source_ref
                    source_port = "value"
                elif "." in source_ref:
                    parts = source_ref.rsplit(".", 1)
                    if parts[0] in node_id_map:
                        source_yaml_id, source_port = parts
                    else:
                        source_yaml_id = source_ref
                        source_port = "value"
                else:
                    source_yaml_id = source_ref
                    source_port = "value"

                source_node_id = node_id_map.get(source_yaml_id)
                if source_node_id:
                    conn = Connection(
                        sheet_id=sheet_id,
                        source_id=source_node_id,
                        source_port=source_port,
                        target_id=target_node_id,
                        target_port=target_port
                    )
                    self.session.add(conn)
        
        await self.session.flush()
        return sheet

async def parse_and_import_yaml(session: AsyncSession, content: str, **kwargs) -> Sheet:
    data = yaml.safe_load(content)
    importer = SheetImporter(session)
    return await importer.import_sheet(data, **kwargs)
