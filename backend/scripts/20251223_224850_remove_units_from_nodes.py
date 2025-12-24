import asyncio
import sys
import os

# Add the parent directory to sys.path to allow imports from src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from src.core.config import settings

async def remove_units():
    print(f"Connecting to database at {settings.DATABASE_URL}...")
    engine = create_async_engine(settings.DATABASE_URL)

    async with engine.begin() as conn:
        print("Executing migration...")
        # PostgreSQL JSONB operator '-' removes a key
        # The '?' operator checks for existence (optional, but good for targeting)
        stmt = text("UPDATE nodes SET data = data - 'unit' WHERE data ? 'unit';")
        result = await conn.execute(stmt)
        print(f"Migration complete. Updated {result.rowcount} nodes.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(remove_units())
