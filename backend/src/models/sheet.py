import uuid
from typing import Any, List, Optional

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class Sheet(Base):
    __tablename__ = "sheets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, index=True)
    owner_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    nodes: Mapped[List["Node"]] = relationship(back_populates="sheet", cascade="all, delete-orphan")
    connections: Mapped[List["Connection"]] = relationship(back_populates="sheet", cascade="all, delete-orphan")

class Node(Base):
    __tablename__ = "nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sheet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sheets.id"))
    
    type: Mapped[str] = mapped_column(String)  # parameter, function, input, output, option
    label: Mapped[str] = mapped_column(String)
    
    # Explicit IO definitions as requested
    # Structure: [{"key": "x", "socket_type": "number"}, ...]
    inputs: Mapped[List[Any]] = mapped_column(JSONB, default=list)
    outputs: Mapped[List[Any]] = mapped_column(JSONB, default=list)
    
    position_x: Mapped[float] = mapped_column(Float)
    position_y: Mapped[float] = mapped_column(Float)
    
    # Flexible data storage (value, unit, code, etc.)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    sheet: Mapped["Sheet"] = relationship(back_populates="nodes")

class Connection(Base):
    __tablename__ = "connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sheet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sheets.id"))
    
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nodes.id"))
    target_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nodes.id"))
    
    source_handle: Mapped[str] = mapped_column(String)
    target_handle: Mapped[str] = mapped_column(String)

    sheet: Mapped["Sheet"] = relationship(back_populates="connections")
