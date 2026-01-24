import asyncio
import os
import sys

# Add the parent directory to sys.path to import modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from src.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Adding default_version_id column to sheets table...")
        try:
            await conn.execute(text("ALTER TABLE sheets ADD COLUMN default_version_id UUID REFERENCES sheet_versions(id) ON DELETE SET NULL;"))
            print("Migration successful.")
        except Exception as e:
            if "already exists" in str(e):
                print("Column already exists.")
            else:
                print(f"Migration failed: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
