import asyncio
import os
import sys

# Add the parent directory to sys.path to allow imports from src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from src.core.config import settings


async def cleanup_old_locks_table():
    print(f"Connecting to database at {settings.DATABASE_URL}...")
    engine = create_async_engine(settings.DATABASE_URL)

    async with engine.begin() as conn:
        print("Checking for old 'locks' table and current 'sheet_locks' table...")
        # Check if table exists and drop it
        await conn.execute(text("DROP TABLE IF EXISTS locks CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS sheet_locks CASCADE;"))
        print("Tables dropped. They will be recreated on next startup with correct constraints.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(cleanup_old_locks_table())
