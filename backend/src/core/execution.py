import io
import multiprocessing
import sys
import traceback
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ExecutionResult(BaseModel):
    result: Optional[Any] = None
    stdout: str = ""
    error: Optional[str] = None
    success: bool = False

def _worker(code: str, inputs: Dict[str, Any], outputs: List[str], queue: multiprocessing.Queue):
    """
    Worker function to execute user code in a separate process.
    """
    # Capture stdout
    old_stdout = sys.stdout
    redirected_output = io.StringIO()
    sys.stdout = redirected_output

    result = None
    error = None
    success = False

    try:
        # Prepare the environment
        # We pass inputs as local variables
        local_vars = inputs.copy()
        global_vars = {
            "__builtins__": __builtins__,
            "math": __import__("math"),
            "np": __import__("numpy"),
        }

        # Execute the code
        # We wrap the code in a function to allow 'return' statements if needed,
        # or just exec it.
        # If the user writes "return x + y", we need to handle it.
        # A common pattern is to wrap it in a function definition.
        
        wrapped_code = f"def user_func({', '.join(inputs.keys())}):\n"
        for line in code.split('\n'):
            wrapped_code += f"    {line}\n"
        wrapped_code += f"    return {', '.join(outputs) if outputs else 'None'}\n"
        
        # Execute the definition
        exec(wrapped_code, global_vars, local_vars)
        
        # Call the function
        user_func = local_vars['user_func']
        result = user_func(**inputs)
        success = True

    except Exception:
        error = traceback.format_exc()
        print("Error during code execution:", error, flush=True)
    finally:
        # Restore stdout
        sys.stdout = old_stdout
        
    # Put result in queue
    if result is not None:
        if len(outputs) == 1:
            result = {outputs[0]: result}
        else:
            result = dict(zip(outputs, result))
    queue.put(ExecutionResult(
        result=result,
        stdout=redirected_output.getvalue(),
        error=error,
        success=success
    ))

def execute_python_code(code: str, inputs: Dict[str, Any], outputs: List[str], timeout: float = 5.0) -> ExecutionResult:
    """
    Executes Python code in a separate process with a timeout.
    """
    queue = multiprocessing.Queue()
    process = multiprocessing.Process(target=_worker, args=(code, inputs, outputs, queue))
    process.start()
    
    process.join(timeout)
    
    if process.is_alive():
        process.terminate()
        process.join()
        return ExecutionResult(
            error="Execution timed out",
            success=False
        )
    
    if not queue.empty():
        return queue.get()
    else:
        return ExecutionResult(
            error="Process crashed or returned no result",
            success=False
        )
