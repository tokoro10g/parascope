import asyncio
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
from RestrictedPython.Guards import (
    guarded_iter_unpack_sequence,
    guarded_unpack_sequence,
    safer_getattr,
)

from .config import settings
from .runtime import (
    SheetBase,
    NodeError,
    ParascopeError,
    NodeExecutionError,
    GraphStructureError,
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
    
    # Add missing essentials often found in ZopeGuards/Restricted environments
    _safe_builtins.update({
        'all': all,
        'any': any,
        'enumerate': enumerate,
        'filter': filter,
        'map': map,
        'max': max,
        'min': min,
        'sum': sum,
        'dict': dict,
        'list': list,
        'set': set,
        'locals': locals,
        'globals': globals,
    })
    
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

            results = {}
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

            def _inplacevar_(op, target, expr):
                if op == '+=':
                    target += expr
                elif op == '-=':
                    target -= expr
                elif op == '*=':
                    target *= expr
                elif op == '/=':
                    target /= expr
                elif op == '//=':
                    target //= expr
                elif op == '%=':
                    target %= expr
                elif op == '**=':
                    target **= expr
                elif op == '<<=':
                    target <<= expr
                elif op == '>>=':
                    target >>= expr
                elif op == '&=':
                    target &= expr
                elif op == '^=':
                    target ^= expr
                elif op == '|=':
                    target |= expr
                return target

            # Construct safe globals
            # We explicitly allow the runtime classes and pre-imported libs
            global_vars = safe_globals.copy()
            global_vars.update({
                "__builtins__": _safe_builtins,
                "__metaclass__": type, # Required for RestrictedPython in some modes
                "__name__": "__restricted_main__",
                "_print_": _print_,
                "_write_": _write_,
                "_inplacevar_": _inplacevar_,
                "_getattr_": safer_getattr,
                "_getitem_": default_guarded_getitem,
                "_getiter_": default_guarded_getiter,
                "_iter_unpack_sequence_": guarded_iter_unpack_sequence,
                "_unpack_sequence_": guarded_unpack_sequence,
                # Runtime Classes
                "SheetBase": SheetBase,
                "NodeError": NodeError,
                "ParascopeError": ParascopeError,
                "NodeExecutionError": NodeExecutionError,
                "GraphStructureError": GraphStructureError,
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

            def extract_full_state(global_vars):
                """Helper to extract recursive state from sheet_instance if it exists"""
                root_sheet = global_vars.get("sheet_instance")
                if root_sheet and isinstance(root_sheet, SheetBase):
                    def traverse(instance: SheetBase):
                        state = {}
                        for nid, res_obj in instance.results.items():
                            state[nid] = res_obj.copy()
                            if nid in instance.node_instances:
                                sub_instance = instance.node_instances[nid]
                                state[nid]['nodes'] = traverse(sub_instance)
                        return state
                    return traverse(root_sheet)
                return global_vars.get("results", {})

            try:
                # Compile and execute the script using RestrictedPython
                code_obj = compile_restricted(script, filename, "exec")
                exec(code_obj, global_vars)
                success = True
            except Exception as e:
                # If it's a SyntaxError from our generator, don't show global toast
                if isinstance(e, SyntaxError) and "\n" in str(e):
                    error = None
                    success = True # Consider it a "graceful" failure if it was handled at node level
                else:
                    error = traceback.format_exc()
                    success = False

            results = extract_full_state(global_vars)
            result_queue.put({"success": success, "error": error, "results": results})

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

    async def execute(self, script: str, timeout: float) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()

        def _blocking_execute():
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

        return await loop.run_in_executor(None, _blocking_execute)


class WorkerPool:
    def __init__(self, count: int):
        self.workers = [WorkerHandle(i) for i in range(count)]
        self.current_index = 0
        self.pool_lock = threading.Lock()

    async def execute(self, script: str, timeout: float = 5.0) -> Dict[str, Any]:
        # Simple Round-Robin distribution
        with self.pool_lock:
            worker = self.workers[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.workers)
        
        return await worker.execute(script, timeout)


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


async def execute_full_script(script: str, timeout: float = 5.0) -> Dict[str, Any]:
    """
    Executes the script using a pool of persistent workers.
    """
    return await _get_worker_pool().execute(script, timeout)