import io
import linecache
import multiprocessing
import queue as pyqueue
import sys
import threading
import traceback
import uuid
from typing import Any, Dict, Optional, List

from pydantic import BaseModel
from RestrictedPython import compile_restricted, safe_globals, safe_builtins, utility_builtins
from RestrictedPython.Eval import default_guarded_getiter, default_guarded_getitem
from RestrictedPython.Guards import guarded_iter_unpack_sequence

from .config import settings
from .runtime import (
    SheetBase,
    NodeError,
    ParascopeError,
    ValueValidationError,
    node,
    sheet,
    function_node,
    constant_node,
    input_node,
    output_node,
    sheet_node,
    lut_node,
)


class ExecutionResult(BaseModel):
    result: Optional[Any] = None
    stdout: str = ""
    error: Optional[str] = None
    success: bool = False


# --- Persistent Worker Pool Implementation ---

def _persistent_worker_loop(task_queue, result_queue, runtime_classes):
    """
    Long-running worker loop.
    Pre-imports heavy libraries to save time on subsequent runs.
    """
    (SheetBase, NodeError, ParascopeError, ValueValidationError, node, sheet, 
     function_node, constant_node, input_node, output_node, sheet_node, lut_node) = runtime_classes

    # Pre-import common scientific libraries
    import math
    import numpy
    import networkx
    
    # Setup RestrictedPython environment
    
    # 1. Define Safe Builtins
    _safe_builtins = safe_builtins.copy()
    _safe_builtins.update(utility_builtins)
    _safe_builtins['locals'] = locals
    _safe_builtins['globals'] = globals
    _safe_builtins['dict'] = dict
    _safe_builtins['list'] = list
    _safe_builtins['set'] = set
    _safe_builtins['str'] = str
    _safe_builtins['int'] = int
    _safe_builtins['float'] = float
    _safe_builtins['bool'] = bool
    _safe_builtins['isinstance'] = isinstance
    _safe_builtins['len'] = len
    _safe_builtins['range'] = range
    
    # 2. Define Safe Import
    def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
        # Whitelist of allowed modules
        allowed_modules = {
            'math', 'numpy', 'scipy', 'networkx', 
            'json', 'datetime', 'time', 'random', 
            'itertools', 'functools', 'collections', 're',
            'traceback'
        }
        
        # Check if the root module is allowed (e.g. numpy.linalg -> check numpy)
        root_name = name.split('.')[0]
        
        if root_name in allowed_modules:
            return __import__(name, globals, locals, fromlist, level)
        
        raise ImportError(f"Import of module '{name}' is not allowed in this environment.")

    _safe_builtins['__import__'] = safe_import

    while True:
        try:
            script = task_queue.get()
            if script is None:  # Sentinel to exit
                break

            # Register script in linecache so traceback can show source lines
            # We use a unique name per execution to avoid cache issues
            filename = f"<parascope-{uuid.uuid4().hex[:8]}>"
            linecache.cache[filename] = (
                len(script),
                None,
                [line + '\n' for line in script.splitlines()],
                filename
            )

            # Capture stdout
            old_stdout = sys.stdout
            redirected_output = io.StringIO()
            sys.stdout = redirected_output

            # Helper for print
            def _print_(*args):
                print(*args, file=redirected_output)

            def _write_(obj):
                return obj

            # Construct safe globals
            # We explicitly allow the runtime classes and pre-imported libs
            global_vars = safe_globals.copy()
            global_vars.update({
                "__builtins__": _safe_builtins,
                "__metaclass__": type, # Required for RestrictedPython in some modes
                "__name__": "__restricted_main__",
                "_print_": _print_,
                "_write_": _write_,
                "_getitem_": default_guarded_getitem,
                "_getiter_": default_guarded_getiter,
                "_iter_unpack_sequence_": guarded_iter_unpack_sequence,
                # Runtime Classes
                "SheetBase": SheetBase,
                "NodeError": NodeError,
                "ParascopeError": ParascopeError,
                "ValueValidationError": ValueValidationError,
                "node": node,
                "sheet": sheet,
                "function_node": function_node,
                "constant_node": constant_node,
                "input_node": input_node,
                "output_node": output_node,
                "sheet_node": sheet_node,
                "lut_node": lut_node,
                # Pre-injected Libraries
                "math": math,
                "numpy": numpy,
                "networkx": networkx,
            })
            
            success = False
            error = None
            results = {}

            try:
                # Compile and execute the script using RestrictedPython
                # This transpiles the code to add runtime checks (guards)
                # 'exec' mode allows top-level statements
                code_obj = compile_restricted(script, filename, "exec")
                exec(code_obj, global_vars)
                results = global_vars.get("results", {})

                # If the script defines a 'sheet_instance' instance (Root), extract its recursive state
                root_sheet = global_vars.get("sheet_instance")
                if root_sheet and isinstance(root_sheet, SheetBase):
                    # Helper to traverse
                    def extract_nodes_state(instance: SheetBase):
                        state = {}
                        # Instance results (node_id -> {value, valid, error})
                        for nid, res_obj in instance.results.items():
                            state[nid] = res_obj.copy()
                            # If this node was a nested sheet, inject its internal state recursively
                            if nid in instance.node_instances:
                                sub_instance = instance.node_instances[nid]
                                state[nid]['nodes'] = extract_nodes_state(sub_instance)
                        return state

                    full_state = extract_nodes_state(root_sheet)
                    results = full_state

                success = True
            except Exception as e:
                # If it's a SyntaxError that we've already registered at the node level,
                # we don't want to show it as a global toast.
                if isinstance(e, SyntaxError) and "\n" in str(e):
                    error = None
                else:
                    error = traceback.format_exc()
            finally:
                sys.stdout = old_stdout

            result_queue.put({
                "success": success,
                "results": results,
                "error": error,
                "stdout": redirected_output.getvalue()
            })

        except Exception as e:
            # Critical failure in the loop (e.g. queue error)
            try:
                result_queue.put({"success": False, "error": f"Worker internal error: {e}"})
            except:
                pass


class WorkerHandle:
    """Manages a single persistent worker process and its queues."""
    def __init__(self, index: int):
        self.index = index
        self.task_queue = multiprocessing.Queue()
        self.result_queue = multiprocessing.Queue()
        self.process: Optional[multiprocessing.Process] = None
        self.lock = threading.Lock() # Ensures only one thread uses this worker at a time
        self._ensure_alive()

    def _ensure_alive(self):
        if self.process is None or not self.process.is_alive():
            self.process = multiprocessing.Process(
                target=_persistent_worker_loop,
                args=(self.task_queue, self.result_queue, (
                    SheetBase, NodeError, ParascopeError, ValueValidationError, node, sheet,
                    function_node, constant_node, input_node, output_node, sheet_node, lut_node
                )),
                daemon=True
            )
            self.process.start()

    def execute(self, script: str, timeout: float) -> Dict[str, Any]:
        with self.lock:
            self._ensure_alive()
            
            # Clear result queue just in case of stale data from a previous crash/timeout
            while not self.result_queue.empty():
                try:
                    self.result_queue.get_nowait()
                except pyqueue.Empty:
                    break

            try:
                self.task_queue.put(script)
            except Exception:
                self.process.terminate()
                self._ensure_alive()
                self.task_queue.put(script)

            try:
                result = self.result_queue.get(timeout=timeout)
                return result
            except pyqueue.Empty:
                # Timeout: Kill and restart worker
                self.process.terminate()
                self.process.join()
                self.process = None
                return {"success": False, "error": "Execution timed out"}


class WorkerPool:
    def __init__(self, count: int):
        self.workers = [WorkerHandle(i) for i in range(count)]
        self.current_index = 0
        self.pool_lock = threading.Lock()

    def execute(self, script: str, timeout: float = 5.0) -> Dict[str, Any]:
        # Simple Round-Robin distribution
        with self.pool_lock:
            worker = self.workers[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.workers)
        
        return worker.execute(script, timeout)


# Global Pool Instance
_worker_pool: Optional[WorkerPool] = None
_init_lock = threading.Lock()

def _get_worker_pool() -> WorkerPool:
    global _worker_pool
    if _worker_pool is None:
        with _init_lock:
            if _worker_pool is None:
                _worker_pool = WorkerPool(settings.WORKER_COUNT)
    return _worker_pool


def execute_full_script(script: str, timeout: float = 5.0) -> Dict[str, Any]:
    """
    Executes the script using a pool of persistent workers.
    """
    return _get_worker_pool().execute(script, timeout)