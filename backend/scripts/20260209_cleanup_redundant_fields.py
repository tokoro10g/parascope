import asyncio
import os
import sys
import json

# Add the parent directory to sys.path to allow imports from src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from src.core.config import settings

def clean_port(port):
    if not isinstance(port, dict):
        return port
    return {"key": port.get("key")}

def clean_ports(ports):
    if not isinstance(ports, list):
        return ports
    return [clean_port(p) for p in ports]

async def cleanup_redundant_fields():
    print(f"Connecting to database at {settings.DATABASE_URL}...")
    engine = create_async_engine(settings.DATABASE_URL)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        print("Dropping redundant columns from connections table...")
        try:
            await conn.execute(text("ALTER TABLE connections DROP COLUMN IF EXISTS source_handle;"))
            await conn.execute(text("ALTER TABLE connections DROP COLUMN IF EXISTS target_handle;"))
            print("Successfully dropped columns.")
        except Exception as e:
            print(f"Error dropping columns: {e}")

    async with AsyncSessionLocal() as session:
        print("Cleaning up nodes table (inputs/outputs)...")
        res = await session.execute(text("SELECT id, inputs, outputs FROM nodes"))
        rows = res.all()
        for node_id, inputs, outputs in rows:
            new_inputs = clean_ports(inputs)
            new_outputs = clean_ports(outputs)
            await session.execute(
                text("UPDATE nodes SET inputs = :inputs, outputs = :outputs WHERE id = :id"),
                {"inputs": json.dumps(new_inputs), "outputs": json.dumps(new_outputs), "id": node_id}
            )
        print(f"Cleaned {len(rows)} nodes.")

        print("Cleaning up sheet_versions table (data)...")
        res = await session.execute(text("SELECT id, data FROM sheet_versions"))
        rows = res.all()
        for version_id, data in rows:
            if not isinstance(data, dict):
                continue
            
            # Clean nodes in version data
            if "nodes" in data:
                for node in data["nodes"]:
                    node["inputs"] = clean_ports(node.get("inputs", []))
                    node["outputs"] = clean_ports(node.get("outputs", []))
            
            # Clean connections in version data
            if "connections" in data:
                for conn in data["connections"]:
                    conn.pop("source_handle", None)
                    conn.pop("target_handle", None)
            
            await session.execute(
                text("UPDATE sheet_versions SET data = :data WHERE id = :id"),
                {"data": json.dumps(data), "id": version_id}
            )
        print(f"Cleaned {len(rows)} versions.")

        await session.commit()

    print("Migration complete.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(cleanup_redundant_fields())
