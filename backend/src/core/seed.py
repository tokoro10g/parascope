import shutil
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.sheet import Folder, Sheet
from .import_export import parse_and_import_yaml


async def seed_database(session: AsyncSession):
    presets_dir = Path(__file__).resolve().parent.parent.parent / "resources" / "presets"
    if not presets_dir.exists():
        print(f"Presets directory not found at {presets_dir}. Skipping seed.")
        return

    print("Seeding database from YAML presets...")

    # Recursive crawl
    for folder_path in presets_dir.iterdir():
        if not folder_path.is_dir():
            continue

        folder_name = folder_path.name
        
        # Check/Create Folder
        result = await session.execute(select(Folder).where(Folder.name == folder_name))
        folder = result.scalar_one_or_none()
        if not folder:
            print(f"Creating folder: {folder_name}")
            folder = Folder(id=uuid.uuid4(), name=folder_name)
            session.add(folder)
            await session.flush()
        else:
            print(f"Folder '{folder_name}' already exists.")

        # Import YAML files in this folder
        for yaml_file in folder_path.glob("*.yaml"):
            # Check if sheet already exists (by name in this folder)
            result = await session.execute(
                select(Sheet).where(Sheet.name == yaml_file.stem.replace("_", " ").title(), Sheet.folder_id == folder.id)
            )
            # Actually, the YAML has a 'name' field, so we should parse it first or just use filename as heuristic
            # Let's just parse it.
            try:
                content = yaml_file.read_text()
                # Simple check if already imported by name
                import yaml as pyyaml
                data = pyyaml.safe_load(content)
                sheet_name = data.get("name")
                
                result = await session.execute(select(Sheet).where(Sheet.name == sheet_name, Sheet.folder_id == folder.id))
                if result.scalar_one_or_none():
                    print(f"Sheet '{sheet_name}' already exists in '{folder_name}'. Skipping.")
                    continue
                
                print(f"Importing sheet: {sheet_name}")
                await parse_and_import_yaml(session, content, folder_id=folder.id)
            except Exception as e:
                print(f"Failed to import {yaml_file}: {e}")

    await session.commit()
    print("Database seeding completed.")
