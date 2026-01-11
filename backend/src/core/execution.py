import io
import multiprocessing
import queue as pyqueue
import sys
import threading
import traceback
from typing import Any, Dict, Optional

from pydantic import BaseModel

try:
    from .runtime import SheetBase, NodeError
except ImportError:
    # Fallback for different execution contexts
    try:
        from src.core.runtime import SheetBase, NodeError
    except ImportError:
        from backend.src.core.runtime import SheetBase, NodeError


class ExecutionResult(BaseModel):
    result: Optional[Any] = None
    stdout: str = ""
    error: Optional[str] = None
    success: bool = False


# --- Persistent Worker Implementation ---

_worker_process: Optional[multiprocessing.Process] = None
_task_queue: Optional[multiprocessing.Queue] = None
_result_queue: Optional[multiprocessing.Queue] = None
_worker_lock = threading.Lock()


def _persistent_worker_loop(task_queue, result_queue, runtime_classes):
    """
    Long-running worker loop.
    Pre-imports heavy libraries to save time on subsequent runs.
    """
    SheetBase, NodeError = runtime_classes

    # Pre-import common scientific libraries
    try:
        import math
        import numpy
    except ImportError:
        pass

    while True:
        try:
            script = task_queue.get()
            if script is None:  # Sentinel to exit
                break

            # Capture stdout
            old_stdout = sys.stdout
            redirected_output = io.StringIO()
            sys.stdout = redirected_output

            global_vars = {
                "SheetBase": SheetBase,
                "NodeError": NodeError
            }
            success = False
            error = None
            results = {}

            try:
                # Execute the script
                exec(script, global_vars)
                results = global_vars.get("results", {})
                success = True
            except Exception:
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


def _ensure_worker():
    global _worker_process, _task_queue, _result_queue
    if _worker_process is None or not _worker_process.is_alive():
        _task_queue = multiprocessing.Queue()
        _result_queue = multiprocessing.Queue()
        _worker_process = multiprocessing.Process(
            target=_persistent_worker_loop,
            args=(_task_queue, _result_queue, (SheetBase, NodeError)),
            daemon=True
        )
        _worker_process.start()


def execute_full_script(script: str, timeout: float = 5.0) -> Dict[str, Any]:
    """
    Executes the script using the persistent worker.
    Restarts the worker if it times out.
    Thread-safe (serialized execution).
    """
    global _worker_process, _task_queue, _result_queue

    with _worker_lock:
        _ensure_worker()
        
        # Send task
        try:
            _task_queue.put(script)
        except Exception:
            # Queue might be broken/closed
            if _worker_process:
                _worker_process.terminate()
            _worker_process = None
            _ensure_worker()
            _task_queue.put(script)

        # Wait for result
        try:
            result = _result_queue.get(timeout=timeout)
            return result
        except pyqueue.Empty:
            # Timeout: Kill the worker to stop the infinite loop/long task
            if _worker_process:
                _worker_process.terminate()
                _worker_process.join()
                _worker_process = None # Force restart
                _task_queue = None
                _result_queue = None
            
            return {"success": False, "error": "Execution timed out"}