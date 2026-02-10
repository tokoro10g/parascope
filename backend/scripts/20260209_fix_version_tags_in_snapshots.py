import asyncio
import os
import sys
import json
from uuid import UUID

# Add the parent directory to sys.path to allow imports from src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from src.core.config import settings
from src.models.sheet import SheetVersion, Node

async def fix_version_tags():
    print(f"Connecting to database at {settings.DATABASE_URL}...")
    engine = create_async_engine(settings.DATABASE_URL)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        # 1. Check nodes table
        print("Checking nodes table...")
        stmt = select(Node).where(Node.type == "sheet")
        result = await session.execute(stmt)
        nodes = result.scalars().all()
        
        version_ids = set()
        for n in nodes:
            vid = n.data.get("versionId")
            if vid:
                version_ids.add(str(vid))
        
        print(f"Found {len(nodes)} sheet nodes, {len(version_ids)} unique version IDs.")

        # 2. Check sheet_versions table
        print("Checking sheet_versions table...")
        stmt = select(SheetVersion)
        result = await session.execute(stmt)
        versions = result.scalars().all()
        for v in versions:
            if isinstance(v.data, dict):
                v_nodes = v.data.get("nodes", [])
                for vn in v_nodes:
                    if vn.get("type") == "sheet":
                        vid = vn.get("data", {}).get("versionId")
                        if vid:
                            version_ids.add(str(vid))

        if not version_ids:
            print("No versioned sheet nodes found. Nothing to do.")
            return

        # 3. Fetch tags
        print(f"Fetching tags for {len(version_ids)} version IDs...")
        tag_map = {}
        uuid_list = [UUID(vid) for vid in version_ids]
        tag_stmt = select(SheetVersion.id, SheetVersion.version_tag).where(SheetVersion.id.in_(uuid_list))
        tag_result = await session.execute(tag_stmt)
        for row in tag_result.all():
            tag_map[str(row.id)] = row.version_tag
        
        # 4. Update nodes
        node_updates = 0
        for n in nodes:
            vid = n.data.get("versionId")
            if vid:
                vid_str = str(vid)
                if vid_str in tag_map:
                    if n.data.get("versionTag") != tag_map[vid_str]:
                        n.data = {**n.data, "versionTag": tag_map[vid_str]}
                        node_updates += 1
        
        # 5. Update versions
        version_updates = 0
        for v in versions:
            if not isinstance(v.data, dict):
                continue
            
            changed = False
            new_data = json.loads(json.dumps(v.data))
            for vn in new_data.get("nodes", []):
                if vn.get("type") == "sheet":
                    node_data = vn.get("data", {})
                    vid = node_data.get("versionId")
                    if vid:
                        vid_str = str(vid)
                        if vid_str in tag_map:
                            if node_data.get("versionTag") != tag_map[vid_str]:
                                node_data["versionTag"] = tag_map[vid_str]
                                changed = True
            if changed:
                v.data = new_data
                version_updates += 1

        if node_updates > 0 or version_updates > 0:
            print(f"Committing updates: {node_updates} nodes, {version_updates} versions.")
            await session.commit()
        else:
            print("No updates needed.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(fix_version_tags())
