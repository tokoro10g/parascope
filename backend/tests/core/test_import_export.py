import pytest
import uuid
import yaml
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from src.core.import_export import parse_and_import_yaml
from src.models.sheet import Sheet, Node, Connection
from src.core.config import settings

DATABASE_URL = settings.DATABASE_URL

@pytest.mark.asyncio
async def test_import_basic_sheet():
    # Manual session creation for core test to avoid fixture mess
    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        yaml_content = """
name: "Test Rocket"
description: "A test sheet"
nodes:
  isp:
    type: input
    label: "Isp"
  calc:
    type: function
    code: "dv = isp * 9.81"
    inputs:
      isp: isp
  out:
    type: output
    input: calc.dv
"""
        sheet = await parse_and_import_yaml(session, yaml_content)
        await session.commit()
        
        # Verify Sheet
        assert sheet.name == "Test Rocket"
        
        # Verify Nodes
        result = await session.execute(select(Node).where(Node.sheet_id == sheet.id))
        nodes = result.scalars().all()
        assert len(nodes) == 3
        
        # Verify Connections
        result = await session.execute(select(Connection).where(Connection.sheet_id == sheet.id))
        conns = result.scalars().all()
        assert len(conns) == 2
        
    await engine.dispose()

@pytest.mark.asyncio
async def test_import_lut_node():
    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        yaml_content = """
name: "LUT Test"
nodes:
  material:
    type: lut
    data:
      lut:
        rows:
          - key: "Steel"
            values: { Density: 7850, Modulus: 210 }
"""
        sheet = await parse_and_import_yaml(session, yaml_content)
        await session.commit()
        
        result = await session.execute(select(Node).where(Node.sheet_id == sheet.id, Node.type == "lut"))
        node = result.scalar_one()
        
        outputs = [o["key"] for o in node.outputs]
        assert "Density" in outputs
        assert "Modulus" in outputs
        
    await engine.dispose()
