from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ..core.auth import get_current_user
from ..core.config import settings
from ..core.database import get_db
from ..models.sheet import Lock, Sheet
from ..schemas.lock import LockRead, SessionRead

router = APIRouter(tags=["concurrency"])


@router.post("/sheets/{sheet_id}/lock", response_model=LockRead)
async def acquire_or_refresh_lock(
    sheet_id: UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User identification required"
        )

    # Check if sheet exists
    sheet_query = select(Sheet).where(Sheet.id == sheet_id)
    sheet_result = await db.execute(sheet_query)
    if not sheet_result.scalar_one_or_none():
         raise HTTPException(status_code=404, detail="Sheet not found")

    query = select(Lock).where(Lock.sheet_id == sheet_id)
    result = await db.execute(query)
    existing_lock = result.scalar_one_or_none()

    now = datetime.utcnow()

    if existing_lock:
        try:
            if existing_lock.user_id == user_id:
                # Refresh
                existing_lock.last_heartbeat_at = now
                await db.commit()
                await db.refresh(existing_lock)
                return existing_lock
            else:
                # Check expiration
                timeout = timedelta(seconds=settings.LOCK_TIMEOUT_SECONDS)
                if now - existing_lock.last_heartbeat_at > timeout:
                    # Steal lock
                    existing_lock.user_id = user_id
                    existing_lock.acquired_at = now
                    existing_lock.last_heartbeat_at = now
                    await db.commit()
                    await db.refresh(existing_lock)
                    return existing_lock
                else:
                    # Conflict
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Sheet is locked by {existing_lock.user_id}",
                    )
        except StaleDataError:
            await db.rollback()
            # Lock was deleted concurrently. Treat as if it didn't exist.
            existing_lock = None

    if not existing_lock:
        # Create new lock
        new_lock = Lock(
            sheet_id=sheet_id,
            user_id=user_id,
            acquired_at=now,
            last_heartbeat_at=now,
        )
        db.add(new_lock)
        try:
            await db.commit()
            await db.refresh(new_lock)
            return new_lock
        except IntegrityError:
            await db.rollback()
            # Lock created concurrently. Fetch and update/check it.
            query = select(Lock).where(Lock.sheet_id == sheet_id)
            result = await db.execute(query)
            existing_lock = result.scalar_one_or_none()

            if not existing_lock:
                 # Should not happen after IntegrityError on PK
                 raise HTTPException(status_code=500, detail="Unexpected concurrency error")

            if existing_lock.user_id == user_id:
                existing_lock.last_heartbeat_at = now
                await db.commit()
                await db.refresh(existing_lock)
                return existing_lock
            else:
                 # Extremely rare race: another user acquired it milliseconds ago
                 # We don't steal it immediately even if timeout logic might apply, 
                 # because they just acquired it.
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Sheet is locked by {existing_lock.user_id}",
                )


@router.post("/sheets/{sheet_id}/lock/force", response_model=LockRead)
async def force_takeover_lock(
    sheet_id: UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User identification required"
        )

    query = select(Lock).where(Lock.sheet_id == sheet_id)
    result = await db.execute(query)
    existing_lock = result.scalar_one_or_none()

    now = datetime.utcnow()

    if existing_lock:
        existing_lock.user_id = user_id
        existing_lock.acquired_at = now
        existing_lock.last_heartbeat_at = now
        # We preserve last_save_at? Or reset? 
        # Requirement doesn't specify, but it makes sense to keep sheet state history or reset if it's a new "session".
        # Let's keep it if we are thinking about the sheet's state, but for "session duration" maybe reset?
        # Let's reset purely for the "session" semantics.
        # However, "Time Since Last Save" is a property of the sheet's modification history.
        # But Lock represents the session.
        # I'll effectively restart the session.
        existing_lock.last_save_at = None 
    else:
        # Create new lock if not exists
        existing_lock = Lock(
            sheet_id=sheet_id,
            user_id=user_id,
            acquired_at=now,
            last_heartbeat_at=now,
        )
        db.add(existing_lock)

    await db.commit()
    await db.refresh(existing_lock)
    return existing_lock


@router.delete("/sheets/{sheet_id}/lock")
async def release_lock(
    sheet_id: UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user_id:
        return # Robustness
    
    query = select(Lock).where(Lock.sheet_id == sheet_id)
    result = await db.execute(query)
    existing_lock = result.scalar_one_or_none()

    if existing_lock and existing_lock.user_id == user_id:
        await db.delete(existing_lock)
        await db.commit()
    
    return {"status": "ok"}


@router.get("/sessions", response_model=List[SessionRead])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    # Clean up stale locks first? Or just filter them?
    # Filtering is safer for read operations.
    # Note: SQLite/Postgres timezone handling can be tricky with utcnow.
    # We'll assume naive UTC for now as per previous code.
    
    query = select(Lock).options(joinedload(Lock.sheet))
    result = await db.execute(query)
    locks = result.scalars().all()
    
    now = datetime.utcnow()
    timeout = timedelta(seconds=settings.LOCK_TIMEOUT_SECONDS)
    
    sessions = []
    for lock in locks:
        # Filter stale locks in python for simplicity
        if now - lock.last_heartbeat_at > timeout:
            continue
            
        duration = None
        if lock.last_save_at:
             duration = (now - lock.last_save_at).total_seconds()
        
        sessions.append({
            "sheet_id": lock.sheet_id,
            "sheet_name": lock.sheet.name,
            "user_id": lock.user_id,
            "acquired_at": lock.acquired_at,
            "last_save_at": lock.last_save_at,
            "duration_since_save": duration
        })
        
    return sessions
