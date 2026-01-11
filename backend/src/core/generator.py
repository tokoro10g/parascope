import textwrap
import uuid
import ast
import networkx as nx
from typing import Any, Dict, List, Set, Tuple
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.sheet import Sheet, Node

class CodeGenerator:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.processed_sheets: Set[str] = set()
        self.definitions: List[str] = []

    async def generate_full_script(self, root_sheet: Sheet, input_overrides: Dict[str, Any]) -> str:
        """
        Generates the complete Python script including all class definitions 
        and the execution entry point.
        """
        # 1. Process dependencies and generate class definitions
        root_class_name = await self._process_sheet_recursive(root_sheet)
        
        # 2. Build the final script
        # We assume SheetBase, NodeError, math, np are injected into globals
        header = "import math\nimport numpy as np\n\n"
        
        definitions_code = "\n\n".join(self.definitions)
        
        entry_point = f"""
# --- Execution Entry Point ---
try:
    overrides = {repr(input_overrides)}
    sheet = {root_class_name}(input_overrides=overrides)
    results = sheet.run()
except Exception as e:
    import traceback
    traceback.print_exc()
    if 'results' not in locals():
        results = {{}}
"""
        return header + definitions_code + entry_point

    async def _process_sheet_recursive(self, sheet: Sheet) -> str:
        sheet_id_str = str(sheet.id)
        if sheet_id_str in self.processed_sheets:
            return self._get_class_name(sheet_id_str)
        
        self.processed_sheets.add(sheet_id_str)

        # 1. Identify Nested Sheets and Process them first
        for node in sheet.nodes:
            if node.type == 'sheet':
                nested_sheet_id = node.data.get('sheetId')
                if nested_sheet_id:
                    # Fetch from DB
                    stmt = select(Sheet).where(Sheet.id == uuid.UUID(nested_sheet_id)).options(
                        selectinload(Sheet.nodes), 
                        selectinload(Sheet.connections)
                    )
                    result = await self.session.execute(stmt)
                    nested_sheet = result.scalars().first()
                    if nested_sheet:
                        await self._process_sheet_recursive(nested_sheet)
        
        # 2. Generate Class Code for this sheet
        class_code = self._generate_sheet_class(sheet)
        self.definitions.append(class_code)
        
        return self._get_class_name(sheet_id_str)

    def _get_class_name(self, sheet_id: str) -> str:
        safe_uuid = sheet_id.replace("-", "_")
        return f"Sheet_{safe_uuid}"

    def _generate_sheet_class(self, sheet: Sheet) -> str:
        class_name = self._get_class_name(str(sheet.id))
        
        # Build DAG for topological sort
        graph = nx.MultiDiGraph()
        node_map = {str(n.id): n for n in sheet.nodes}
        
        for n in sheet.nodes:
            graph.add_node(str(n.id), type=n.type)
            
        for conn in sheet.connections:
            graph.add_edge(str(conn.source_id), str(conn.target_id), 
                           source_port=conn.source_port, target_port=conn.target_port)
            
        try:
            execution_order = list(nx.topological_sort(graph))
        except nx.NetworkXUnfeasible:
            # Cycle detected, fallback or handle error?
            # For now, simplistic approach: Just ignore order? No, cycle is fatal.
            # We'll rely on graph validation before this.
            execution_order = list(graph.nodes()) 

        # Generate Methods
        result_code = [f"class {class_name}(SheetBase):"]
        
        # Generate node methods
        for node in sheet.nodes:
            method_code = self._generate_node_method(node)
            if method_code:
                result_code.append(textwrap.indent(method_code, "    "))
        
        # Find output nodes for public interface
        output_nodes = [n for n in sheet.nodes if n.type == 'output']
        
        # Generate compute() method
        compute_body = []
        for node_id in execution_order:
            if node_id not in node_map: continue
            node = node_map[node_id]
            
            # Prepare inputs
            # Find incoming edges
            in_edges = graph.in_edges(node_id, data=True)
            inputs_map = {}
            for u, v, data in in_edges:
                target_port = data['target_port']
                source_port = data.get('source_port', 'output') # default
                inputs_map[target_port] = (u, source_port)
            
            block = self._generate_node_call(node, inputs_map)
            compute_body.append(block)

        if not compute_body:
            compute_body.append("pass")

        result_code.append("    def compute(self):")
        result_code.append(textwrap.indent("\n".join(compute_body), "        "))
        
        # Helper to expose public outputs (Output Nodes) by Label
        expose_body = ["return {"]
        for n in output_nodes:
            # We want the VALUE of the output node
            # self.results[str(n.id)]['value']
            # Safely get it
            nid = str(n.id)
            label = n.label
            expose_body.append(f"    '{label}': self.results.get('{nid}', {{}}).get('value'),")
        expose_body.append("}")
        
        result_code.append("    def get_public_outputs(self):")
        result_code.append(textwrap.indent("\n".join(expose_body), "        "))

        return "\n".join(result_code)

    def _generate_node_method(self, node: Node) -> str:
        nid = str(node.id).replace("-", "_")
        
        if node.type == 'function':
            args_list = []
            if node.inputs:
                for inp in node.inputs:
                    if isinstance(inp, dict):
                        args_list.append(inp.get("key"))
            
            args_str = ", ".join(args_list)

            code = node.data.get("code", "pass")
            
            # Syntax Check
            try:
                # We wrap it in a function def to check context (e.g. return statement validity)
                # But simple check is ast.parse
                ast.parse(code)
            except SyntaxError as e:
                # Generate a method that raises this error at runtime
                # We escape the error message
                err_msg = str(e).replace('"', '\\"').replace("'", "\\'")
                return f"""
def node_{nid}(self, {args_str}):
    raise SyntaxError("{err_msg}")
"""

            indented_code = textwrap.indent(code, "    ")
            
            # Outputs
            ret_dict_entries = []
            if node.outputs:
                for out in node.outputs:
                    if isinstance(out, dict):
                        key = out.get("key")
                        ret_dict_entries.append(f"'{key}': {key}")
            
            ret_stmt = f"    return {{{', '.join(ret_dict_entries)}}}" if ret_dict_entries else "    return {}"

            return f"def node_{nid}(self, {args_str}):\n{indented_code}\n{ret_stmt}"

        elif node.type == 'sheet':
            # Nested Sheet
            # The method instanties the sheet and runs it?
            # Or we do it in compute.
            # It's cleaner to have a helper method.
            nested_id = node.data.get("sheetId")
            if not nested_id: return "pass"
            nested_class = self._get_class_name(nested_id)
            
            return f"""
def node_{nid}(self, inputs):
    # Instantiate nested sheet
    sub = {nested_class}(input_overrides=inputs)
    sub.run()
    return sub.get_public_outputs()
"""
        return ""

    def _generate_node_call(self, node: Node, inputs_map: Dict[str, Tuple[str, str]]) -> str:
        nid = str(node.id).replace("-", "_")
        node_id_str = str(node.id)
        
        # Common logic: try/except
        
        if node.type == 'constant':
            val = node.data.get("value", 0)
            is_option = node.data.get("dataType") == "option"
            
            # Validation logic
            validation_code = ""
            if is_option:
                opts = node.data.get("options", [])
                validation_code = f"val = self.validate_option(val, {repr(opts)})"
            else:
                d_min = node.data.get("min")
                d_max = node.data.get("max")
                validation_code = f"""
val = self.parse_number(val)
val = self.validate_range(val, {repr(d_min)}, {repr(d_max)})
"""
            
            validation_code = textwrap.indent(validation_code.strip(), "    ")

            return f"""
# Node: {node.label} (Constant)
try:
    val = self.get_input_value('{node_id_str}', '{node.label}', default={repr(val)})
{validation_code}
    self.register_result('{node_id_str}', val)
except Exception as e:
    self.register_error('{node_id_str}', str(e))
"""

        elif node.type == 'input':
            default_val = node.data.get("value", None) # Or default value field
            is_option = node.data.get("dataType") == "option"
            
            validation_code = ""
            if is_option:
                opts = node.data.get("options", [])
                validation_code = f"val = self.validate_option(val, {repr(opts)})"
            else:
                d_min = node.data.get("min")
                d_max = node.data.get("max")
                validation_code = f"""
val = self.parse_number(val)
val = self.validate_range(val, {repr(d_min)}, {repr(d_max)})
"""
            validation_code = textwrap.indent(validation_code.strip(), "    ")

            return f"""
# Node: {node.label} (Input)
try:
    val = self.get_input_value('{node_id_str}', '{node.label}', default={repr(default_val)})
    if val is None: raise ValueError("Input required")
{validation_code}
    self.register_result('{node_id_str}', val)
except Exception as e:
    self.register_error('{node_id_str}', str(e))
"""

        elif node.type == 'output':
             # Just pass through from source
             # Logic is: Output receives from ONE source.
            source_info = list(inputs_map.values())
            if not source_info:
                 return f"self.register_result('{node_id_str}', None)"
            
            src_id, src_port = source_info[0]
            src_id_safe = str(src_id) # keep dashes for dict lookup
            
            return f"""
# Node: {node.label} (Output)
try:
    val = self.get_value('{src_id_safe}', '{src_port}')
    self.register_result('{node_id_str}', val)
except Exception as e:
    self.register_error('{node_id_str}', str(e))
"""

        elif node.type == 'function':
            # Construct args
            call_args = []
            
            # Use defined inputs to order arguments
            defined_inputs = []
            if node.inputs:
                for inp in node.inputs:
                    defined_inputs.append(inp.get("key"))
            
            for arg_name in defined_inputs:
                if arg_name in inputs_map:
                    src_id, src_port = inputs_map[arg_name]
                    call_args.append(f"{arg_name}=self.get_value('{src_id}', '{src_port}')")
                else:
                    # Missing input -> Pass None
                    call_args.append(f"{arg_name}=None")

            args_str = ", ".join(call_args)
            
            return f"""
# Node: {node.label} (Function)
try:
    res = self.node_{nid}({args_str})
    self.register_result('{node_id_str}', res)
except Exception as e:
    self.register_error('{node_id_str}', str(e))
"""

        elif node.type == 'sheet':
            # Nested sheet inputs
            # We need to map inputs. 
            # The input name for the nested sheet is the 'target_port' of the connection.
            
            args_construction = []
            for arg_name, (src_id, src_port) in inputs_map.items():
                args_construction.append(f"'{arg_name}': self.get_value('{src_id}', '{src_port}')")
            args_str = ", ".join(args_construction)

            return f"""
# Node: {node.label} (Nested Sheet)
try:
    inputs = {{{args_str}}}
    res_dict = self.node_{nid}(inputs)
    # The result of a sheet is a Dict of outputs.
    # We register the whole dict as the value. 
    # self.get_value handles extracting keys.
    self.register_result('{node_id_str}', res_dict)
except Exception as e:
    self.register_error('{node_id_str}', str(e))
"""
        
        return ""
