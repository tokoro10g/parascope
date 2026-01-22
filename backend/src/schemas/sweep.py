from uuid import UUID
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class SweepRequest(BaseModel):
    input_node_id: UUID
    start_value: str | None = None
    end_value: str | None = None
    increment: str | None = None
    manual_values: List[str] | None = None
    output_node_ids: List[UUID]
    input_overrides: Dict[UUID, str] = {}


class SweepHeader(BaseModel):
    id: UUID
    label: str
    type: str # "input" or "output"


class SweepResponse(BaseModel):
    headers: List[SweepHeader]
    # results is a list of rows, where each row is a list of values matching the headers
    results: List[List[Any]]
    error: str | None = None
