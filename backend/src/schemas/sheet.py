from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PortDefinition(BaseModel):
    key: str
    socket_type: Optional[str] = None
    label: Optional[str] = None

class NodeBase(BaseModel):
    type: str
    label: str
    inputs: List[PortDefinition] = []
    outputs: List[PortDefinition] = []
    position_x: float
    position_y: float
    data: Dict[str, Any] = {}

class NodeCreate(NodeBase):
    id: Optional[UUID] = None

class NodeRead(NodeBase):
    id: UUID
    sheet_id: UUID
    model_config = ConfigDict(from_attributes=True)

class ConnectionBase(BaseModel):
    source_id: UUID
    target_id: UUID
    source_handle: str
    target_handle: str

class ConnectionCreate(ConnectionBase):
    id: Optional[UUID] = None

class ConnectionRead(ConnectionBase):
    id: UUID
    sheet_id: UUID
    model_config = ConfigDict(from_attributes=True)

class SheetBase(BaseModel):
    name: str
    owner_name: Optional[str] = None

class SheetCreate(SheetBase):
    nodes: List[NodeCreate] = []
    connections: List[ConnectionCreate] = []

class SheetRead(SheetBase):
    id: UUID
    nodes: List[NodeRead]
    connections: List[ConnectionRead]
    model_config = ConfigDict(from_attributes=True)

class SheetUpdate(BaseModel):
    name: Optional[str] = None
    nodes: List[NodeCreate]
    connections: List[ConnectionCreate]
