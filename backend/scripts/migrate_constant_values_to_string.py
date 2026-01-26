import asyncio
import os
import sys

# Add the parent directory to sys.path to allow imports from src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from src.core.config import settings


async def migrate_constant_values_to_string():
    print(f"Connecting to database at {settings.DATABASE_URL}...")
    engine = create_async_engine(settings.DATABASE_URL)

    async with engine.begin() as conn:
        print("Executing migration...")

        # Update 'constant' nodes: convert data.value from number to string
        # We only target nodes where the value is actually a JSON number to avoid unnecessary updates
        stmt = text("""
            UPDATE nodes 
            SET data = jsonb_set(data, '{value}', to_jsonb(data->>'value'))
            WHERE type = 'constant' 
              AND data ? 'value'
              AND jsonb_typeof(data->'value') = 'number';
        """)
        result = await conn.execute(stmt)
        print(f"Migration complete. Updated {result.rowcount} nodes.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate_constant_values_to_string())
