from typing import Any, Dict, List
from uuid import UUID

from pydantic import BaseModel


class SweepRequest(BaseModel):
    input_node_id: UUID
    start_value: str | None = None
    end_value: str | None = None
    increment: str | None = None
    manual_values: List[str] | None = None
    
    # Secondary Input (Optional)
    secondary_input_node_id: UUID | None = None
    secondary_start_value: str | None = None
    secondary_end_value: str | None = None
    secondary_increment: str | None = None
    secondary_manual_values: List[str] | None = None

    output_node_ids: List[UUID]
    input_overrides: Dict[UUID, str] = {}


class SweepHeader(BaseModel):
    id: UUID
    label: str
    type: str # "input" or "output"


class SweepResponse(BaseModel):
    headers: List[SweepHeader]
    results: List[List[Any]]
    metadata: List[Dict[str, Any]] | None = None
    error: str | None = None
