import shutil
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.sheet import Folder, Sheet
from .import_export import SheetImporter, parse_and_import_yaml


async def seed_database(session: AsyncSession):
    presets_dir = Path(__file__).resolve().parent.parent.parent / "resources" / "presets"
    if not presets_dir.exists():
        print(f"Presets directory not found at {presets_dir}. Skipping seed.")
        return

    print("Seeding database from YAML presets (two-pass)...")
    importer = SheetImporter(session)
    
    # Store parsed data for second pass
    pending_sheets = [] # list of (Sheet object, yaml_data dict)

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

        # Pass 1: Create all Sheet records
        for yaml_file in folder_path.glob("*.yaml"):
            try:
                content = yaml_file.read_text()
                import yaml as pyyaml
                data = pyyaml.safe_load(content)
                sheet_name = data.get("name")
                
                result = await session.execute(select(Sheet).where(Sheet.name == sheet_name, Sheet.folder_id == folder.id))
                if result.scalar_one_or_none():
                    print(f"Sheet '{sheet_name}' already exists in '{folder_name}'. Skipping.")
                    continue
                
                print(f"Pass 1: Creating sheet record for {sheet_name}")
                sheet = await importer.create_sheet_record(data, folder_id=folder.id)
                pending_sheets.append((sheet, data))
            except Exception as e:
                print(f"Failed to parse {yaml_file} in Pass 1: {e}")

    await session.flush()

    # Pass 2: Import nodes and connections
    for sheet, data in pending_sheets:
        try:
            print(f"Pass 2: Importing nodes/connections for {sheet.name}")
            await importer.import_nodes_and_connections(sheet, data)
        except Exception as e:
            print(f"Failed to import nodes for {sheet.name} in Pass 2: {e}")

    await session.commit()
    print("Database seeding completed.")

