from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PortDefinition(BaseModel):
    key: str


# --- Concrete Node Data Schemas ---


class ParameterNodeData(BaseModel):
    value: Any = None
    min: Optional[float] = None
    max: Optional[float] = None
    dataType: Optional[str] = None  # "number", "option", etc.
    options: Optional[List[str]] = None
    description: Optional[str] = None
    hidden: bool = False


class FunctionNodeData(BaseModel):
    code: str = ""
    description: Optional[str] = None


class SheetNodeData(BaseModel):
    sheetId: Optional[UUID] = None
    versionId: Optional[UUID] = None
    versionTag: Optional[str] = None
    defaultVersionId: Optional[UUID] = None
    ownerName: Optional[str] = None


class LUTRow(BaseModel):
    key: Any
    values: Dict[str, Any]


class LUTData(BaseModel):
    rows: List[LUTRow] = []


class LUTNodeData(BaseModel):
    lut: LUTData = Field(default_factory=LUTData)
    description: Optional[str] = None


class OutputNodeData(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    description: Optional[str] = None
    hidden: bool = False


# --- Discriminated Union for Nodes ---


class NodeShared(BaseModel):
    label: str
    inputs: List[PortDefinition] = []
    outputs: List[PortDefinition] = []
    position_x: float
    position_y: float


class ConstantNode(NodeShared):
    type: Literal["constant"]
    data: ParameterNodeData = Field(default_factory=ParameterNodeData)


class InputNode(NodeShared):
    type: Literal["input"]
    data: ParameterNodeData = Field(default_factory=ParameterNodeData)


class FunctionNode(NodeShared):
    type: Literal["function"]
    data: FunctionNodeData = Field(default_factory=FunctionNodeData)


class SheetNode(NodeShared):
    type: Literal["sheet"]
    data: SheetNodeData = Field(default_factory=SheetNodeData)


class LUTNode(NodeShared):
    type: Literal["lut"]
    data: LUTNodeData = Field(default_factory=LUTNodeData)


class OutputNode(NodeShared):
    type: Literal["output"]
    data: OutputNodeData = Field(default_factory=OutputNodeData)


class CommentNodeData(BaseModel):
    description: Optional[str] = ""


class CommentNode(NodeShared):
    type: Literal["comment"]
    data: CommentNodeData = Field(default_factory=CommentNodeData)


# Node Creation Union
class NodeCreateMixin(BaseModel):
    id: Optional[UUID] = None


class ConstantNodeCreate(NodeCreateMixin, ConstantNode):
    pass


class InputNodeCreate(NodeCreateMixin, InputNode):
    pass


class FunctionNodeCreate(NodeCreateMixin, FunctionNode):
    pass


class SheetNodeCreate(NodeCreateMixin, SheetNode):
    pass


class LUTNodeCreate(NodeCreateMixin, LUTNode):
    pass


class OutputNodeCreate(NodeCreateMixin, OutputNode):
    pass


class CommentNodeCreate(NodeCreateMixin, CommentNode):
    pass


NodeCreate = Union[
    ConstantNodeCreate,
    InputNodeCreate,
    FunctionNodeCreate,
    SheetNodeCreate,
    LUTNodeCreate,
    OutputNodeCreate,
    CommentNodeCreate,
]


# Node Reading Union
class NodeReadMixin(BaseModel):
    id: UUID
    model_config = ConfigDict(from_attributes=True)


class ConstantNodeRead(NodeReadMixin, ConstantNode):
    pass


class InputNodeRead(NodeReadMixin, InputNode):
    pass


class FunctionNodeRead(NodeReadMixin, FunctionNode):
    pass


class SheetNodeRead(NodeReadMixin, SheetNode):
    pass


class LUTNodeRead(NodeReadMixin, LUTNode):
    pass


class OutputNodeRead(NodeReadMixin, OutputNode):
    pass


class CommentNodeRead(NodeReadMixin, CommentNode):
    pass


NodeRead = Union[
    ConstantNodeRead, InputNodeRead, FunctionNodeRead, SheetNodeRead, LUTNodeRead, OutputNodeRead, CommentNodeRead
]


class ConnectionBase(BaseModel):
    source_id: UUID
    target_id: UUID
    source_port: str
    target_port: str


class ConnectionCreate(ConnectionBase):
    id: Optional[UUID] = None


class ConnectionRead(ConnectionBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)


class FolderBase(BaseModel):
    name: str
    parent_id: Optional[UUID] = None


class FolderCreate(FolderBase):
    pass


class FolderRead(FolderBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None


class SheetBase(BaseModel):
    name: str
    owner_name: Optional[str] = None
    folder_id: Optional[UUID] = None


class SheetCreate(SheetBase):
    nodes: List[NodeCreate] = []
    connections: List[ConnectionCreate] = []


class SheetRead(SheetBase):
    id: UUID
    default_version_id: Optional[UUID] = None
    nodes: List[NodeRead]
    connections: List[ConnectionRead]
    model_config = ConfigDict(from_attributes=True)

    @field_validator("nodes")
    @classmethod
    def sort_nodes(cls, v: List[NodeRead]) -> List[NodeRead]:
        v.sort(key=lambda n: (n.position_x, n.position_y))
        return v


class SheetSummary(SheetBase):
    id: UUID
    folder_id: Optional[UUID] = None
    default_version_id: Optional[UUID] = None
    has_updates: bool = False
    model_config = ConfigDict(from_attributes=True)


class SheetUpdate(BaseModel):
    name: Optional[str] = None
    folder_id: Optional[UUID] = None
    default_version_id: Optional[UUID] = None
    nodes: Optional[List[NodeCreate]] = None
    connections: Optional[List[ConnectionCreate]] = None


class AuditLogRead(BaseModel):
    id: UUID
    sheet_id: UUID
    user_name: str
    timestamp: datetime
    delta: List[Any]
    is_unread: bool = False
    model_config = ConfigDict(from_attributes=True)


class UserReadStateRead(BaseModel):
    user_name: str
    sheet_id: UUID
    last_read_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SheetVersionCreate(BaseModel):
    version_tag: str
    description: Optional[str] = None


class SheetSnapshot(BaseModel):
    nodes: List[NodeRead] = []
    connections: List[ConnectionRead] = []

    @field_validator("nodes")
    @classmethod
    def sort_nodes(cls, v: List[NodeRead]) -> List[NodeRead]:
        v.sort(key=lambda n: (n.position_x, n.position_y))
        return v


class SheetVersionRead(BaseModel):
    id: UUID
    sheet_id: UUID
    version_tag: str
    description: Optional[str]
    data: SheetSnapshot
    created_at: datetime
    created_by: str
    model_config = ConfigDict(from_attributes=True)


class SheetVersionSummary(BaseModel):
    id: UUID
    sheet_id: UUID
    version_tag: str
    description: Optional[str]
    created_at: datetime
    created_by: str
    model_config = ConfigDict(from_attributes=True)
