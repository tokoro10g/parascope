from uuid import UUID
from typing import List, Dict, Any
from pydantic import BaseModel


class SweepRequest(BaseModel):
    input_node_id: UUID
    start_value: str
    end_value: str
    increment: str
    output_node_ids: List[UUID]
    input_overrides: Dict[UUID, Any] = {}


class SweepResultStep(BaseModel):
    input_value: float
    outputs: Dict[UUID, Any]
    error: str | None = None


class SweepResponse(BaseModel):
    results: List[SweepResultStep]