from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class LockBase(BaseModel):
    sheet_id: UUID
    user_id: str


class LockRead(LockBase):
    acquired_at: datetime
    last_heartbeat_at: datetime
    last_save_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SessionRead(LockBase):
    sheet_name: str
    sheet_id: UUID
    user_id: str
    acquired_at: datetime
    last_save_at: Optional[datetime] = None
    duration_since_save: Optional[float] = None # Seconds

    class Config:
        from_attributes = True
