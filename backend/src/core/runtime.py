import inspect
from typing import Any, Dict, List, Optional, Union

class ParascopeError(Exception):
    """Base error for Parascope execution"""
    pass

class NodeError(ParascopeError):
    def __init__(self, node_id: str, message: str):
        self.node_id = node_id
        self.message = message
        super().__init__(f"Error in node {node_id}: {message}")

class ValidationResult:
    def __init__(self, valid: bool, error: Optional[str] = None, value: Any = None):
        self.valid = valid
        self.error = error
        self.value = value

class SheetBase:
    """
    Base class for all generated Sheet classes.
    Handles storage of results, input injection, and validation helpers.
    """
    def __init__(self, input_overrides: Dict[str, Any] = None):
        self.input_overrides = input_overrides or {}
        self.results: Dict[str, Dict[str, Any]] = {}
        self.node_map: Dict[str, Any] = {} # Metadata about nodes

    def register_result(self, node_id: str, value: Any):
        """Register a successful result"""
        self.results[node_id] = {"value": value, "valid": True}

    def register_error(self, node_id: str, error: str):
        """Register a failure"""
        self.results[node_id] = {"value": None, "valid": False, "error": error}

    def get_value(self, node_id: str, port: str = None):
        """Retrieve a value from a previous node's output"""
        if node_id not in self.results:
            raise NodeError(node_id, "Node has not been executed yet")
        
        res = self.results[node_id]
        if not res.get("valid", False):
             raise NodeError(node_id, f"Dependency failed: {res.get('error')}")
        
        val = res.get("value")
        # If port is specified and value is a dict (multi-output), get it
        if port and isinstance(val, dict) and port in val:
            return val[port]
        # If port is specified but value is not a dict, implies single output mapped implicitly? 
        # Or typical 1-output node.
        return val

    def get_input_value(self, node_id: str, label: str, default: Any = None) -> Any:
        """Helper to resolve input node values from overrides"""
        # Checks by ID then Label
        val = None
        if node_id in self.input_overrides:
            val = self.input_overrides[node_id]
        elif label in self.input_overrides:
            val = self.input_overrides[label]
        
        if val is None:
            val = default
            
        return val

    # --- Validation Helpers ---
    def validate_option(self, value: Any, options: List[str]) -> Any:
        # Convert to string for comparison matches frontend behavior
        str_val = str(value)
        if str_val not in options:
            raise ValueError(f"Value '{value}' is not in allowed options: {options}")
        return str_val

    def validate_range(self, value: Any, min_val: Optional[float], max_val: Optional[float]) -> Any:
        if value is None:
            return value
        if not isinstance(value, (int, float)):
            return value # Cannot range check non-numbers
        
        if min_val is not None and value < min_val:
             raise ValueError(f"Value {value} is below minimum {min_val}")
        if max_val is not None and value > max_val:
             raise ValueError(f"Value {value} is above maximum {max_val}")
        return value

    def parse_number(self, value: Any) -> Union[int, float, None]:
        if value is None or value == "":
            return None
        try:
            return int(value)
        except ValueError:
            return float(value)

    # --- Execution ---
    def run(self) -> Dict[str, Dict[str, Any]]:
        """
        Main execution method. Should be overridden by generated class.
        """
        self.compute()
        return self.results

    def compute(self):
        """
        To be implemented by the generated class.
        Calls node methods in order.
        """
        pass
