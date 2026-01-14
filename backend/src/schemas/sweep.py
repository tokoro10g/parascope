from uuid import UUID
from typing import List, Dict, Any
from pydantic import BaseModel


class SweepRequest(BaseModel):
    input_node_id: UUID
    start_value: str | None = None
    end_value: str | None = None
    increment: str | None = None
    manual_values: List[str] | None = None
    output_node_ids: List[UUID]
    input_overrides: Dict[UUID, str] = {}


class SweepResultStep(BaseModel):
    input_value: Any  # Changed from float to Any to support strings
    outputs: Dict[UUID, Any]
    error: str | None = None


class SweepResponse(BaseModel):
    results: List[SweepResultStep]
    error: str | None = None