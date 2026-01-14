import inspect
import traceback
import networkx as nx
from typing import Any, Dict, List, Optional, Union

class ParascopeError(Exception):
    """Base error for Parascope execution"""
    pass

class NodeError(ParascopeError):
    def __init__(self, node_id: str, message: str):
        self.node_id = node_id
        self.message = message
        super().__init__(f"Error in node {node_id}: {message}")

class ValueValidationError(ParascopeError):
    """Raised when a value validation fails (range, options, types)"""
    def __init__(self, message: str, value: Any = None):
        self.message = message
        self.value = value
        super().__init__(message)

class DependencyError(ParascopeError):
    """Raised when a node fails due to upstream dependency failure"""
    def __init__(self, message: str = None):
        self.message = message
        super().__init__(message or "Dependency failed")

def sheet(sheet_id: str):
    """Decorator to tag class as a Sheet"""
    def decorator(cls):
        cls._sheet_id = sheet_id
        return cls
    return decorator

def node(node_id: str, inputs: Dict[str, str] = None, type: str = "function", label: str = None, **kwargs):
    """Decorator to tag methods with their Node UUID and configuration"""
    def decorator(func):
        func._node_config = {
            "id": node_id,
            "inputs": inputs or {},
            "type": type,
            "label": label,
            **kwargs
        }
        return func
    return decorator

def function_node(node_id: str, inputs: Dict[str, str] = None, label: str = None, **kwargs):
    return node(node_id, inputs=inputs, type="function", label=label, **kwargs)

def constant_node(node_id: str, label: str = None, value: Any = None, min: float = None, max: float = None, options: List[str] = None, **kwargs):
    """Decorator for Constant Nodes with built-in validation logic"""
    def decorator(func):
        # Configuration
        func._node_config = {
            "id": node_id,
            "inputs": {},
            "type": "constant",
            "label": label,
        }
        
        # Standard Implementation
        def wrapper(self, *args, **kwargs):
            val = self.get_input_value(node_id, label, default=value)
            
            if options:
                val = self.validate_option(val, options)
            else:
                val = self.parse_number(val)
                val = self.validate_range(val, min, max)
                
            return val

        # Copy metadata
        wrapper._node_config = func._node_config
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator

def input_node(node_id: str, label: str = None, value: Any = None, min: float = None, max: float = None, options: List[str] = None, **kwargs):
    """Decorator for Input Nodes with built-in validation logic"""
    def decorator(func):
        func._node_config = {
            "id": node_id,
            "inputs": {},
            "type": "input",
            "label": label,
        }
        
        def wrapper(self, *args, **kwargs):
            val = self.get_input_value(node_id, label, default=value)
            if val is None: 
                raise ValueValidationError(f"Input '{label}' required")
            
            if options:
                val = self.validate_option(val, options)
            else:
                val = self.parse_number(val)
                val = self.validate_range(val, min, max)
                
            return val

        wrapper._node_config = func._node_config
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator

def output_node(node_id: str, inputs: Dict[str, str] = None, label: str = None, min: float = None, max: float = None, **kwargs):
    """Decorator for Output Nodes - Pass through logic with validation"""
    def decorator(func):
        func._node_config = {
            "id": node_id,
            "inputs": inputs or {},
            "type": "output",
            "label": label,
        }
        
        def wrapper(self, *args, **kwargs):
            # Return the first available argument as value
            val = None
            if args: 
                val = args[0]
            elif kwargs: 
                val = next(iter(kwargs.values()))
            
            # Perform validation if configured
            val = self.validate_range(val, min, max)

            return val

        wrapper._node_config = func._node_config
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator

def sheet_node(node_id: str, inputs: Dict[str, str] = None, label: str = None, **kwargs):
    return node(node_id, inputs=inputs, type="sheet", label=label, **kwargs)

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
        self.node_instances: Dict[str, 'SheetBase'] = {} # Track nested sheet instances

    def register_result(self, node_id: str, value: Any):
        """Register a successful result"""
        self.results[node_id] = {"value": value, "valid": True}
        
    def register_instance(self, node_id: str, instance: 'SheetBase'):
        """Register a nested sheet instance for state inspection"""
        self.node_instances[node_id] = instance

    def register_error(self, node_id: str, error: Optional[str], internal_error: Optional[str] = None):
        """
        Register a failure.
        :param error: The error message to be displayed (or None to suppress)
        :param internal_error: The underlying error message for debugging/upstream propagation
        """
        self.results[node_id] = {
            "value": None, 
            "valid": False, 
            "error": error, 
            "internal_error": internal_error or error
        }

    def get_value(self, node_id: str, port: str = None):
        """Retrieve a value from a previous node's output"""
        if node_id not in self.results:
            raise NodeError(node_id, "Node has not been executed yet")
        
        res = self.results[node_id]
        if not res.get("valid", False):
             cause = res.get('internal_error') or res.get('error')
             raise DependencyError(cause)
        
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
        if node_id in self.input_overrides:
            return self.input_overrides[node_id]
            
        if label in self.input_overrides:
            return self.input_overrides[label]
        
        return default

    # --- Validation Helpers ---
    def validate_option(self, value: Any, options: List[str]) -> Any:
        # Convert to string for comparison matches frontend behavior
        str_val = str(value)
        if str_val not in options:
            raise ValueValidationError(f"Value '{value}' is not in allowed options: {options}", value)
        return str_val

    def validate_range(self, value: Any, min_val: Optional[float], max_val: Optional[float]) -> Any:
        if value is None:
            return value
        if not isinstance(value, (int, float)):
            return value # Cannot range check non-numbers
        
        if (min_val is not None and value < min_val) or (max_val is not None and value > max_val):
             min_str = str(min_val) if min_val is not None else "-inf"
             max_str = str(max_val) if max_val is not None else "inf"
             raise ValueValidationError(f"Value {value} is out of range [{min_str}, {max_str}]", value)
        return value

    def parse_number(self, value: Any) -> Union[int, float, str, None]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return value
        try:
            return int(value)
        except (ValueError, TypeError):
            try:
                return float(value)
            except (ValueError, TypeError):
                return value

    def get_public_outputs(self, raise_on_error: bool = False) -> Dict[str, Any]:
        """
        Collect values from all output nodes.
        :param raise_on_error: If True, raises NodeError if an output node has a registered error.
        """
        outputs = {}
        for name in dir(self):
            attr = getattr(self, name)
            if hasattr(attr, '_node_config'):
                cfg = attr._node_config
                node_type = cfg.get('type')
                
                # Expose both explicit Output nodes AND Constant nodes as sheet outputs
                if node_type == 'output' or node_type == 'constant':
                    lbl = cfg.get('label') or name
                    nid = cfg['id']
                    
                    res = self.results.get(nid, {})
                    
                    if raise_on_error and not res.get('valid', False):
                        if 'internal_error' in res:
                            # Use internal_error to get the root cause even if the output node was silenced
                            err = res.get('internal_error') or res.get('error')
                            raise NodeError(nid, f"Output '{lbl}' failed: {err}")

                    # The value of an output node is what it 'passed through'
                    # The value of a constant node is its configured value
                    val = res.get('value')
                    outputs[lbl] = val
        return outputs

    # --- Execution ---
    def run(self) -> Dict[str, Any]:
        """
        Main execution method.
        Dynamically discovers decorated methods, builds dependency graph, and executes.
        """
        # 1. Discover Nodes
        methods = {}
        node_id_map = {} # method_name -> node_id
        
        for name in dir(self):
            attr = getattr(self, name)
            if hasattr(attr, '_node_config'):
                methods[name] = attr
                node_id_map[name] = attr._node_config['id']

        # 2. Build Graph
        G = nx.DiGraph()
        G.add_nodes_from(methods.keys())
        
        for name, method in methods.items():
            inputs = method._node_config.get('inputs', {})
            for arg_name, src_ref in inputs.items():
                if not src_ref: continue
                # Parse "MethodName:Port" or "MethodName"
                src_method = src_ref.split(':')[0] if ':' in src_ref else src_ref
                
                if src_method in methods:
                    G.add_edge(src_method, name)
        
        # 3. Topological Sort
        try:
            execution_order = list(nx.topological_sort(G))
        except nx.NetworkXUnfeasible:
            # Cycle detected
            raise ParascopeError("Cycle detected in sheet graph")
            
        # 4. Execute
        for name in execution_order:
            method = methods[name]
            cfg = method._node_config
            node_id = cfg['id']
            
            # Prepare Inputs
            kwargs = {}
            inputs_def = cfg.get('inputs', {})
            
            try:
                for arg, src_ref in inputs_def.items():
                    if not src_ref:
                        kwargs[arg] = None
                        continue
                        
                    if ':' in src_ref:
                        src_method, src_port = src_ref.split(':')
                    else:
                        src_method, src_port = src_ref, None # Implicit?
                    
                    if src_method not in methods:
                        # Could be a missing reference
                        kwargs[arg] = None
                        continue

                    # Retrieve dependency value
                    src_node_id = node_id_map[src_method]
                    
                    # Use get_value helper
                    val = self.get_value(src_node_id, src_port)
                    kwargs[arg] = val

                # Call Method
                res = method(**kwargs)
                
                # Register Result (Handle dicts vs usage)
                self.register_result(node_id, res)
                
            except (DependencyError, ValueValidationError) as e:
                # Upstream failure or Validation failure
                is_validation = isinstance(e, ValueValidationError)
                
                # If this is an output node, we MUST show the error to escape the sheet boundary
                # Otherwise, stay silent to reduce clutter
                show_error = cfg.get('type') == 'output' or is_validation
                
                # For validation errors, we always want to show the message on the node itself
                msg = str(e) if is_validation else e.message

                # Special Case: Validation errors (e.g. out of range) should 'soft fail'
                # They return the invalid value but attach the error message, keeping valid=True for downstream.
                # Creates a "warning" state effectively.
                if is_validation:
                    self.results[node_id] = {
                        "value": e.value,
                        "valid": True, # Keep valid so it doesn't break logic expecting success
                        "error": msg
                    }
                else:
                    self.register_error(
                        node_id, 
                        error=msg if show_error else None,
                        internal_error=msg
                    )

            except Exception as e:
                # Capture method-level errors (these are always visible)
                tb = traceback.format_exc()
                self.register_error(node_id, f"{str(e)}\n\n{tb}")
                # For unexpected errors, stop execution
                raise e
        
        # 5. Collect Public Outputs
        return self.get_public_outputs()
