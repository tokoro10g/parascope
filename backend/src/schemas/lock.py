from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class LockBase(BaseModel):
    sheet_id: UUID
    user_id: str
    tab_id: Optional[str] = None


class LockRead(LockBase):
    acquired_at: datetime
    last_heartbeat_at: datetime
    last_save_at: Optional[datetime] = None
    tab_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class LockAcquire(BaseModel):
    tab_id: str


class SessionRead(LockBase):
    sheet_name: str
    sheet_id: UUID
    user_id: str
    acquired_at: datetime
    last_save_at: Optional[datetime] = None
    duration_since_save: Optional[float] = None  # Seconds

    model_config = ConfigDict(from_attributes=True)
