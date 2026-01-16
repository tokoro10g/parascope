from datetime import datetime
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
    source_port: str
    target_port: str
    source_handle: Optional[str] = None
    target_handle: Optional[str] = None


class ConnectionCreate(ConnectionBase):
    id: Optional[UUID] = None


class ConnectionRead(ConnectionBase):
    id: UUID
    sheet_id: UUID
    model_config = ConfigDict(from_attributes=True)


class FolderBase(BaseModel):
    name: str
    parent_id: Optional[UUID] = None


class FolderCreate(FolderBase):
    pass


class FolderRead(FolderBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)


class SheetBase(BaseModel):
    name: str
    owner_name: Optional[str] = None
    folder_id: Optional[UUID] = None


class SheetCreate(SheetBase):
    nodes: List[NodeCreate] = []
    connections: List[ConnectionCreate] = []


class SheetRead(SheetBase):
    id: UUID
    nodes: List[NodeRead]
    connections: List[ConnectionRead]
    model_config = ConfigDict(from_attributes=True)


class SheetSummary(SheetBase):
    id: UUID
    folder_id: Optional[UUID] = None
    has_updates: bool = False
    model_config = ConfigDict(from_attributes=True)


class SheetUpdate(BaseModel):
    name: Optional[str] = None
    folder_id: Optional[UUID] = None
    nodes: Optional[List[NodeCreate]] = None
    connections: Optional[List[ConnectionCreate]] = None


class AuditLogRead(BaseModel):
    id: UUID
    sheet_id: UUID
    user_name: str
    timestamp: datetime
    delta: List[Any]
    model_config = ConfigDict(from_attributes=True)


class UserReadStateRead(BaseModel):
    user_name: str
    sheet_id: UUID
    last_read_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SheetVersionCreate(BaseModel):
    version_tag: str
    description: Optional[str] = None


class SheetVersionRead(BaseModel):
    id: UUID
    sheet_id: UUID
    version_tag: str
    description: Optional[str]
    data: Dict[str, Any]
    created_at: datetime
    created_by: str
    model_config = ConfigDict(from_attributes=True)
