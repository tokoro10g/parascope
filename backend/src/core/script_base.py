
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

    if min_val is not None and min_val != "":
        try:
            min_val = float(min_val)
            if value < min_val:
                raise ValueRangeValidationError(
                    str(node_id), label, f"Value {value} is less than minimum {min_val}", value
                )
        except ValueError:
            pass

    if max_val is not None and max_val != "":
        try:
            max_val = float(max_val)
            if value > max_val:
                raise ValueRangeValidationError(
                    str(node_id), label, f"Value {value} is greater than maximum {max_val}", value
                )
        except ValueError:
            pass

results = {}
