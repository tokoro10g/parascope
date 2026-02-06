import uuid
from typing import Any, Dict

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.calculation_service import get_input_overrides, run_calculation
from ..core.database import get_db
from ..core.generator import CodeGenerator
from ..models.sheet import Connection, Node, Sheet
from ..schemas.sheet import SheetCreate

router = APIRouter(prefix="/calculate", tags=["calculate"])


class PreviewRequest(BaseModel):
    inputs: Dict[str, Dict[str, Any]] = {}
    graph: SheetCreate


def construct_sheet(body: PreviewRequest) -> Sheet:
    sheet_id = uuid.uuid4()
    nodes = []
    for n in body.graph.nodes:
        # Use mode='json' to ensure nested Pydantic models (like data) are converted to dicts
        # for SQLAlchemy JSONB columns.
        node_data = n.model_dump(mode="json")
        if not node_data.get("id"):
            node_data["id"] = uuid.uuid4()
        nodes.append(Node(**node_data, sheet_id=sheet_id))

    connections = []
    for c in body.graph.connections:
        conn_data = c.model_dump(mode="json")
        connections.append(Connection(**conn_data, sheet_id=sheet_id))

    return Sheet(
        id=sheet_id,
        name=body.graph.name,
        owner_name=body.graph.owner_name,
        folder_id=body.graph.folder_id,
        nodes=nodes,
        connections=connections,
    )


@router.post("/")
async def calculate_preview(
    body: PreviewRequest,
    db: AsyncSession = Depends(get_db),
):
    sheet = await run_in_threadpool(construct_sheet, body)
    return await run_calculation(sheet, body.inputs, db)


@router.post("/script")
async def generate_script_preview(
    body: PreviewRequest,
    db: AsyncSession = Depends(get_db),
):
    sheet = await run_in_threadpool(construct_sheet, body)
    input_overrides = get_input_overrides(sheet, body.inputs)

    generator = CodeGenerator(db)
    script = await generator.generate_full_script(sheet, input_overrides)
    return {"script": script}
