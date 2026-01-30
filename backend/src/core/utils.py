from typing import Any

def serialize_result(val: Any) -> Any:
    """
    Serializes calculation results for API response.
    Converts all numbers (int/float) to strings to safely handle NaN/Infinity.
    Recursively handles dicts and lists.
    """
    if isinstance(val, dict):
        return {k: serialize_result(v) for k, v in val.items()}
    if isinstance(val, list):
        return [serialize_result(v) for v in val]
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return str(val)
    if val is None:
        return None
    return str(val)
