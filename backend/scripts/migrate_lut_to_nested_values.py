import asyncio
import os
import sys

# Add the parent directory to sys.path to allow imports from src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.core.config import settings
from src.models.sheet import Node


async def migrate_lut_to_nested_values():
    print(f"Connecting to database at {settings.DATABASE_URL}...")
    engine = create_async_engine(settings.DATABASE_URL)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        print("Fetching LUT nodes...")
        stmt = select(Node).where(Node.type == "lut")
        result = await session.execute(stmt)
        nodes = result.scalars().all()

        updated_count = 0
        for node in nodes:
            lut_data = node.data.get("lut", {})
            rows = lut_data.get("rows", [])

            needs_update = False
            new_rows = []

            for row in rows:
                # If row has more than 'key' but no 'values' object, it's old format
                if "key" in row and "values" not in row and len(row.keys()) > 1:
                    needs_update = True
                    new_row = {"key": row["key"], "values": {}}
                    for k, v in row.items():
                        if k != "key":
                            new_row["values"][k] = v
                    new_rows.append(new_row)
                else:
                    new_rows.append(row)

            if needs_update:
                print(f"Updating node {node.id} ({node.label})...")
                node.data["lut"]["rows"] = new_rows
                session.add(node)
                updated_count += 1

        if updated_count > 0:
            await session.commit()
            print(f"Migration complete. Updated {updated_count} LUT nodes.")
        else:
            print("No LUT nodes required migration.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate_lut_to_nested_values())
