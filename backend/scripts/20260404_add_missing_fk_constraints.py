"""
Migration: Add missing FK ON DELETE constraints and unique constraint on sheet_versions.

Changes:
- nodes.sheet_id:         ADD ON DELETE CASCADE
- connections.sheet_id:   ADD ON DELETE CASCADE
- connections.source_id:  ADD ON DELETE CASCADE
- connections.target_id:  ADD ON DELETE CASCADE
- sheet_versions(sheet_id, version_tag): ADD UNIQUE constraint
  (sheet.default_version_id already has ON DELETE SET NULL from prior migration)
"""

import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from src.core.config import settings


async def migrate():
    print(f"Connecting to {settings.DATABASE_URL}...")
    engine = create_async_engine(settings.DATABASE_URL, echo=True)

    async with engine.begin() as conn:
        # ----------------------------------------------------------------
        # 1. nodes.sheet_id → ON DELETE CASCADE
        # ----------------------------------------------------------------
        print("\n[1/5] Updating nodes.sheet_id FK to ON DELETE CASCADE...")
        await conn.execute(text("ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_sheet_id_fkey;"))
        await conn.execute(
            text(
                "ALTER TABLE nodes ADD CONSTRAINT nodes_sheet_id_fkey "
                "FOREIGN KEY (sheet_id) REFERENCES sheets(id) ON DELETE CASCADE;"
            )
        )

        # ----------------------------------------------------------------
        # 2. connections.sheet_id → ON DELETE CASCADE
        # ----------------------------------------------------------------
        print("\n[2/5] Updating connections.sheet_id FK to ON DELETE CASCADE...")
        await conn.execute(text("ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_sheet_id_fkey;"))
        await conn.execute(
            text(
                "ALTER TABLE connections ADD CONSTRAINT connections_sheet_id_fkey "
                "FOREIGN KEY (sheet_id) REFERENCES sheets(id) ON DELETE CASCADE;"
            )
        )

        # ----------------------------------------------------------------
        # 3. connections.source_id → ON DELETE CASCADE
        # ----------------------------------------------------------------
        print("\n[3/5] Updating connections.source_id FK to ON DELETE CASCADE...")
        await conn.execute(text("ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_source_id_fkey;"))
        await conn.execute(
            text(
                "ALTER TABLE connections ADD CONSTRAINT connections_source_id_fkey "
                "FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE;"
            )
        )

        # ----------------------------------------------------------------
        # 4. connections.target_id → ON DELETE CASCADE
        # ----------------------------------------------------------------
        print("\n[4/5] Updating connections.target_id FK to ON DELETE CASCADE...")
        await conn.execute(text("ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_target_id_fkey;"))
        await conn.execute(
            text(
                "ALTER TABLE connections ADD CONSTRAINT connections_target_id_fkey "
                "FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE;"
            )
        )

        # ----------------------------------------------------------------
        # 5. UNIQUE(sheet_id, version_tag) on sheet_versions
        # ----------------------------------------------------------------
        print("\n[5/5] Adding UNIQUE(sheet_id, version_tag) on sheet_versions...")
        await conn.execute(
            text("ALTER TABLE sheet_versions DROP CONSTRAINT IF EXISTS uq_sheet_versions_sheet_id_version_tag;")
        )
        await conn.execute(
            text(
                "ALTER TABLE sheet_versions ADD CONSTRAINT "
                "uq_sheet_versions_sheet_id_version_tag "
                "UNIQUE (sheet_id, version_tag);"
            )
        )

    print("\nMigration completed successfully.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate())
