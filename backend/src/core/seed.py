import uuid
from pathlib import Path
from typing import Optional

import sqlalchemy
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.sheet import Folder, Sheet, SheetVersion
from .import_export import SheetImporter


async def seed_database(session: AsyncSession):
    presets_dir = Path(__file__).resolve().parent.parent.parent / "resources" / "presets"
    resource_dir = Path(__file__).resolve().parent.parent.parent / "resources"

    if not presets_dir.exists():
        print(f"Presets directory not found at {presets_dir}. Skipping seed.")
        return

    print("Seeding database from YAML presets (recursive two-pass)...")
    importer = SheetImporter(session, resource_dirs=[resource_dir])

    # Store parsed data for second pass
    pending_sheets = []  # list of (Sheet object, yaml_data dict, base_path Path)
    folder_cache = {}  # path_str -> Folder object

    async def get_or_create_folder(rel_path: Path) -> Optional[uuid.UUID]:
        if rel_path == Path("."):
            return None

        path_str = str(rel_path)
        if path_str in folder_cache:
            return folder_cache[path_str].id

        # Ensure parent exists
        parent_id = await get_or_create_folder(rel_path.parent)

        # Check DB
        folder_name = rel_path.name
        result = await session.execute(select(Folder).where(Folder.name == folder_name, Folder.parent_id == parent_id))
        folder = result.scalar_one_or_none()

        if not folder:
            print(f"Creating folder: {rel_path}")
            folder = Folder(id=uuid.uuid4(), name=folder_name, parent_id=parent_id)
            session.add(folder)
            await session.flush()

        folder_cache[path_str] = folder
        return folder.id

    # Pass 1: Recursive crawl to create folders and Sheet records
    for yaml_file in presets_dir.rglob("*.yaml"):
        try:
            rel_folder_path = yaml_file.parent.relative_to(presets_dir)
            folder_id = await get_or_create_folder(rel_folder_path)

            content = yaml_file.read_text()
            import yaml as pyyaml

            data = pyyaml.safe_load(content)
            sheet_name = data.get("name")
            version_tag = str(data.get("version", "1.0"))

            # Check if sheet already exists in this specific folder
            result = await session.execute(select(Sheet).where(Sheet.name == sheet_name, Sheet.folder_id == folder_id))
            sheet = result.scalar_one_or_none()

            if sheet:
                # Check version
                if sheet.default_version_id:
                    v_result = await session.execute(
                        select(SheetVersion).where(SheetVersion.id == sheet.default_version_id)
                    )
                    current_v = v_result.scalar_one_or_none()
                    if current_v and current_v.version_tag == version_tag:
                        # print(f"Sheet '{sheet_name}' is up to date (v{version_tag}).")
                        continue

                print(f"Pass 1: Updating sheet record for {sheet_name} (to v{version_tag})")
                # Clear existing nodes/conns for re-import
                from ..models.sheet import Connection, Node

                await session.execute(sqlalchemy.delete(Connection).where(Connection.sheet_id == sheet.id))
                await session.execute(sqlalchemy.delete(Node).where(Node.sheet_id == sheet.id))
                pending_sheets.append((sheet, data, yaml_file.parent))
            else:
                print(f"Pass 1: Creating sheet record for {sheet_name} (v{version_tag})")
                sheet = await importer.create_sheet_record(data, folder_id=folder_id)
                pending_sheets.append((sheet, data, yaml_file.parent))
        except Exception as e:
            print(f"Failed to parse {yaml_file} in Pass 1: {e}")

    await session.flush()

    # Pass 2: Import nodes and connections
    for sheet, data, base_path in pending_sheets:
        try:
            print(f"Pass 2: Importing nodes/connections for {sheet.name}")
            await importer.import_nodes_and_connections(sheet, data, base_path=base_path)
        except Exception as e:
            print(f"Failed to import nodes for {sheet.name} in Pass 2: {e}")
            import traceback

            traceback.print_exc()

    try:
        await session.commit()
        print("Database seeding completed.")
    except Exception as e:
        print(f"Failed to commit database seed: {e}")
        import traceback

        traceback.print_exc()
        await session.rollback()
