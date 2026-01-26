import asyncio
import os
import sys

# Add the parent directory to sys.path to allow imports from src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from src.core.config import settings


async def migrate_number_to_any():
    print(f"Connecting to database at {settings.DATABASE_URL}...")
    engine = create_async_engine(settings.DATABASE_URL)

    async with engine.begin() as conn:
        print("Executing migration...")

        # update dataType 'number' to 'any'
        stmt = text("""
            UPDATE nodes 
            SET data = jsonb_set(data, '{dataType}', '"any"') 
            WHERE data->>'dataType' = 'number';
        """)
        result = await conn.execute(stmt)
        print(f"Migration complete. Updated {result.rowcount} nodes.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate_number_to_any())
