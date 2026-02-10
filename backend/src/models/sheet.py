import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


def make_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def utcnow():
    return datetime.now(timezone.utc)


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, index=True)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("folders.id"), nullable=True)

    parent: Mapped[Optional["Folder"]] = relationship("Folder", remote_side=[id], back_populates="children")
    children: Mapped[List["Folder"]] = relationship("Folder", back_populates="parent", cascade="all, delete-orphan")
    sheets: Mapped[List["Sheet"]] = relationship(back_populates="folder")


class Sheet(Base):
    __tablename__ = "sheets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, index=True)
    owner_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    folder_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("folders.id"), nullable=True)
    default_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("sheet_versions.id", use_alter=True, name="fk_sheet_default_version_id"), nullable=True
    )

    folder: Mapped[Optional["Folder"]] = relationship(back_populates="sheets")
    nodes: Mapped[List["Node"]] = relationship(back_populates="sheet", cascade="all, delete-orphan")
    connections: Mapped[List["Connection"]] = relationship(back_populates="sheet", cascade="all, delete-orphan")
    locks: Mapped[List["SheetLock"]] = relationship(back_populates="sheet", cascade="all, delete-orphan")
    audit_logs: Mapped[List["AuditLog"]] = relationship(back_populates="sheet", cascade="all, delete-orphan")
    read_states: Mapped[List["UserReadState"]] = relationship(back_populates="sheet", cascade="all, delete-orphan")
    versions: Mapped[List["SheetVersion"]] = relationship(
        back_populates="sheet", cascade="all, delete-orphan", foreign_keys="SheetVersion.sheet_id"
    )
    default_version: Mapped[Optional["SheetVersion"]] = relationship(foreign_keys=[default_version_id])


class Node(Base):
    __tablename__ = "nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sheet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sheets.id"))

    type: Mapped[str] = mapped_column(String)  # parameter, function, input, output, option
    label: Mapped[str] = mapped_column(String)

    # Explicit IO definitions as requested
    # Structure: [{"key": "x"}, ...]
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
    source_port: Mapped[str] = mapped_column(String)
    target_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nodes.id"))
    target_port: Mapped[str] = mapped_column(String)

    sheet: Mapped["Sheet"] = relationship(back_populates="connections")


class SheetLock(Base):
    __tablename__ = "sheet_locks"

    sheet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sheets.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    tab_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_heartbeat_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_save_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    sheet: Mapped["Sheet"] = relationship("Sheet", back_populates="locks")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sheet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sheets.id", ondelete="CASCADE"), index=True)
    user_name: Mapped[str] = mapped_column(String, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    delta: Mapped[List[Any]] = mapped_column(JSONB, default=list)

    sheet: Mapped["Sheet"] = relationship("Sheet", back_populates="audit_logs")


class UserReadState(Base):
    __tablename__ = "user_read_states"

    user_name: Mapped[str] = mapped_column(String, primary_key=True)
    sheet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sheets.id", ondelete="CASCADE"), primary_key=True)
    last_read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    sheet: Mapped["Sheet"] = relationship("Sheet", back_populates="read_states")


class SheetVersion(Base):
    __tablename__ = "sheet_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sheet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sheets.id", ondelete="CASCADE"), index=True)
    version_tag: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_by: Mapped[str] = mapped_column(String)

    sheet: Mapped["Sheet"] = relationship("Sheet", back_populates="versions", foreign_keys=[sheet_id])
