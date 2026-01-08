
import math
import numpy as np

def _parse_value(val):
    try:
        if isinstance(val, str):
            if val.lower() == "true":
                return True
            elif val.lower() == "false":
                return False
            else:
                try:
                    return int(val)
                except ValueError:
                    return float(val)
    except ValueError:
        pass
    return val

class ValueRangeValidationError(Exception):
    def __init__(self, node_id, label, message, value):
        self.node_id = node_id
        self.label = label
        self.error_message = message
        self.value = value
        super().__init__(message)

class StopExecution(Exception):
    pass

def _validate_option(node_id, label, data, value):
    if data.get("dataType") == "option":
        options = data.get("options", [])
        str_value = str(value)
        if str_value not in options:
            raise ValueRangeValidationError(
                str(node_id), label, f"Value '{value}' is not a valid option. Allowed: {options}", value
            )

def _validate_range(node_id, label, data, value):
    if value is None:
        return

    # Only validate numbers
    if not isinstance(value, (int, float)):
        return

    min_val = data.get("min")
    max_val = data.get("max")

    v_min = None
    v_max = None

    if min_val is not None and min_val != "":
        try:
            v_min = float(min_val)
        except ValueError:
            pass

    if max_val is not None and max_val != "":
        try:
            v_max = float(max_val)
        except ValueError:
            pass

    if (v_min is not None and value < v_min) or (v_max is not None and value > v_max):
        range_str = f"[{v_min if v_min is not None else '-inf'}, {v_max if v_max is not None else 'inf'}]"
        raise ValueRangeValidationError(
            str(node_id), label, f"Value {value} is out of the range {range_str}", value
        )

results = {}
