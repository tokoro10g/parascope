import textwrap
import uuid
import ast
import re
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
        self.sheet_class_names: Dict[str, str] = {}
        self.used_class_names: Set[str] = set()

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
    sheet.run()
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    if 'sheet' in locals():
        results = sheet.results
    else:
        results = {{}}
"""
        return header + definitions_code + entry_point

    async def generate_sweep_script(
        self, 
        root_sheet: Sheet, 
        input_values: List[Any], 
        input_node_id: str, 
        static_overrides: Dict[str, Any],
        output_node_ids: List[str]
    ) -> str:
        """
        Generates a script that executes the sheet logic iteratively for a sweep.
        """
        # 1. Process dependencies and generate class definitions
        root_class_name = await self._process_sheet_recursive(root_sheet)
        
        # 2. Build the final script
        # We assume SheetBase, NodeError, math, np are injected into globals
        header = "import math\nimport numpy as np\n\n"
        
        definitions_code = "\n\n".join(self.definitions)
        
        entry_point = f"""
# --- Sweep Execution Entry Point ---
try:
    input_values = {repr(input_values)}
    static_overrides = {repr(static_overrides)}
    input_node_id = {repr(input_node_id)}
    output_node_ids = {repr(output_node_ids)}
    
    sweep_results = []
    
    for val in input_values:
        current_overrides = static_overrides.copy()
        current_overrides[input_node_id] = val
        
        step_res = {{ "input_value": val, "outputs": {{}} }}
        
        try:
            sheet = {root_class_name}(input_overrides=current_overrides)
            # Run the sheet
            sheet.run()
            raw_results = sheet.results
            
            # Extract requested outputs
            for out_id in output_node_ids:
                node_res = raw_results.get(out_id)
                # Handle different result formats
                final_val = None
                if isinstance(node_res, dict):
                    if 'value' in node_res:
                         final_val = node_res['value']
                    elif 'valid' in node_res and not node_res['valid']:
                         final_val = None # Error state, maybe capture error?
                    else:
                        # Try to find a numeric value if it's a multi-output but we want 'the' value
                        # Default to None if complex
                        for v in node_res.values():
                            if isinstance(v, (int, float)):
                                final_val = v
                                break
                else:
                     final_val = node_res
                
                step_res["outputs"][out_id] = final_val

        except Exception as e:
            step_res["error"] = str(e)
            # Ensure outputs are populated with None/Null for consistent structure
            for out_id in output_node_ids:
                step_res["outputs"][out_id] = None
            
        sweep_results.append(step_res)

    results = sweep_results

except Exception as e:
    import traceback
    traceback.print_exc()
    if 'results' not in locals():
        results = []
"""
        return header + definitions_code + entry_point

    async def _process_sheet_recursive(self, sheet: Sheet) -> str:
        sheet_id_str = str(sheet.id)
        if sheet_id_str in self.processed_sheets:
            return self._get_class_name(sheet_id_str)
        
        self._register_sheet_name(sheet)
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
        if sheet_id in self.sheet_class_names:
            return self.sheet_class_names[sheet_id]
        safe_uuid = sheet_id.replace("-", "_")
        return f"Sheet_{safe_uuid}"

    def _register_sheet_name(self, sheet: Sheet):
        sheet_id_str = str(sheet.id)
        if sheet_id_str in self.sheet_class_names:
            return

        # Sanitize for Class Name (PascalCase preference)
        raw_name = sheet.name or "Sheet"
        # Remove invalid chars
        clean = re.sub(r'[^a-zA-Z0-9_]', '', raw_name.title().replace(" ", ""))
        if not clean:
            clean = "Sheet"
        if not clean[0].isalpha() and clean[0] != '_':
            clean = f"Sheet{clean}"
            
        name = clean
        idx = 1
        while name in self.used_class_names:
            name = f"{clean}_{idx}"
            idx += 1
            
        self.used_class_names.add(name)
        self.sheet_class_names[sheet_id_str] = name

    def _sanitize_identifier(self, text: str) -> str:
        if not text:
            return ""
        # Preserve case, replace invalid chars with underscore
        clean = re.sub(r'[^a-zA-Z0-9_]', '_', text)
        # Must start with letter/underscore
        if clean and not clean[0].isalpha() and clean[0] != '_':
            clean = f"_{clean}"
        # Cleanup underscores
        clean = re.sub(r'_+', '_', clean)
        return clean

    def _generate_sheet_class(self, sheet: Sheet) -> str:
        class_name = self._get_class_name(str(sheet.id))
        
        # 1. Determine Method Names and Identify Inputs for ALL nodes
        node_method_map = {}
        used_names = set()
        
        # Reserve names to avoid conflicts with SheetBase methods or Python keywords
        used_names.update([
            "compute", "run", "get_public_outputs", 
            "validate_option", "validate_range", "parse_number",
            "register_result", "register_error", "get_value", "get_input_value",
            "results", "node_map", "input_overrides"
        ])

        for node in sheet.nodes:
            base_name = self._sanitize_identifier(node.label)
            if not base_name:
                base_name = f"node_{node.type}"
            
            name = base_name
            idx = 1
            while name in used_names:
                name = f"{base_name}_{idx}"
                idx += 1
            
            used_names.add(name)
            node_method_map[str(node.id)] = name

        # 2. Build Connections Map (Target Node ID -> { arg_name: "MethodName:Port" })
        from collections import defaultdict
        node_inputs_map = defaultdict(dict)
        node_arg_mapping = defaultdict(dict)
        
        # Helper to find connections targeting a node
        connections_by_target = defaultdict(list)
        for conn in sheet.connections:
            connections_by_target[str(conn.target_id)].append(conn)

        for node in sheet.nodes:
            nid = str(node.id)
            target_conns = connections_by_target[nid]
            
            for conn in target_conns:
                source_nid = str(conn.source_id)
                if source_nid not in node_method_map: continue
                
                source_method = node_method_map[source_nid]
                source_port = conn.source_port or 'output'
                target_port = conn.target_port 
                
                # Sanitize argument name to match Python signature requirements
                arg_name = self._sanitize_identifier(target_port)
                if not arg_name:
                    arg_name = f"arg_{target_port}" if target_port else "arg_input"

                # Handle collision if multiple inputs map to same sanitized name
                base_arg = arg_name
                idx = 1
                while arg_name in node_inputs_map[nid]:
                    arg_name = f"{base_arg}_{idx}"
                    idx += 1
                
                # Format: "MethodName:SourcePort"
                node_inputs_map[nid][arg_name] = f"{source_method}:{source_port}"
                node_arg_mapping[nid][arg_name] = target_port

        # 3. Generate Methods
        result_code = [f"@sheet('{sheet.id}')", f"class {class_name}(SheetBase):"]
        
        for node in sheet.nodes:
            nid = str(node.id)
            method_name = node_method_map[nid]
            inputs_config = node_inputs_map[nid]
            arg_mapping = node_arg_mapping[nid]
            
            method_code = self._generate_node_method(node, method_name, inputs_config, arg_mapping)
            if method_code:
                result_code.append(textwrap.indent(method_code, "    "))
        


        return "\n".join(result_code)

    def _generate_node_method(self, node: Node, method_name: str, inputs_config: Dict[str, str], arg_mapping: Dict[str, str] = None) -> str:
        nid = str(node.id)
        label_safe = node.label.replace("'", "\\'")
        arg_mapping = arg_mapping or {}
        
        # Verify inputs_config vs expected inputs to ensure signature valid?
        # Use keys from inputs_config as arguments
        # Only valid python identifiers allowed as args
        args = [k for k in inputs_config.keys() if k.isidentifier()]
        args_str = ", ".join(args)
        
        dict_str = repr(inputs_config) # e.g. {'x': 'node_a:val'}

        if node.type == 'function':
            # Code from user
            code = node.data.get("code", "pass")
            
            # Syntax Check
            try:
                ast.parse(code)
            except SyntaxError as e:
                err_msg = str(e).replace('"', '\\"').replace("'", "\\'")
                return f"""
@function_node("{nid}", inputs={dict_str}, label="{label_safe}")
def {method_name}(self, {args_str}):
    raise SyntaxError("{err_msg}")
"""
            indented_code = textwrap.indent(code, "    ")
            
            # Function outputs construction
            ret_dict_entries = []
            if node.outputs:
                for out in node.outputs:
                    if isinstance(out, dict):
                        key = out.get("key")
                        if key: ret_dict_entries.append(f"'{key}': {key}")
            
            ret_stmt = f"    return {{{', '.join(ret_dict_entries)}}}" if ret_dict_entries else "    return {}"

            return f"""
@function_node("{nid}", inputs={dict_str}, label="{label_safe}")
def {method_name}(self, {args_str}):
{indented_code}
{ret_stmt}
"""

        elif node.type == 'sheet':
            # Nested Sheet
            nested_id = node.data.get("sheetId")
            if not nested_id: return "pass"
            nested_class = self._get_class_name(nested_id)
            
            # Construct dictionary to pass to sub-sheet
            # keys matching input_overrides
            overrides_items = []
            for arg in args:
                original_key = arg_mapping.get(arg, arg).replace("'", "\\'")
                overrides_items.append(f"'{original_key}': {arg}")
            overrides_str = f"{{{', '.join(overrides_items)}}}"

            return f"""
@sheet_node("{nid}", inputs={dict_str}, label="{label_safe}")
def {method_name}(self, {args_str}):
    sub = {nested_class}(input_overrides={overrides_str})
    self.register_instance("{nid}", sub)
    sub.run()
    return sub.get_public_outputs(raise_on_error=True)
"""

        elif node.type == 'constant':
            val = node.data.get("value", None)
            is_option = node.data.get("dataType") == "option"
            
            params = []
            if is_option:
                opts = node.data.get("options", [])
                params.append(f"options={repr(opts)}")
            else:
                d_min = node.data.get("min")
                d_max = node.data.get("max")
                if d_min is not None: params.append(f"min={d_min}")
                if d_max is not None: params.append(f"max={d_max}")
                
            params.append(f"value={repr(val)}")
            params_str = ", ".join(params)

            return f"""
@constant_node("{nid}", label="{label_safe}", {params_str})
def {method_name}(self): pass
"""

        elif node.type == 'input':
            default_val = node.data.get("value", None)
            is_option = node.data.get("dataType") == "option"
            
            params = []
            if is_option:
                opts = node.data.get("options", [])
                params.append(f"options={repr(opts)}")
            else:
                d_min = node.data.get("min")
                d_max = node.data.get("max")
                if d_min is not None: params.append(f"min={d_min}")
                if d_max is not None: params.append(f"max={d_max}")
            
            params.append(f"value={repr(default_val)}")
            params_str = ", ".join(params)

            return f"""
@input_node("{nid}", label="{label_safe}", {params_str})
def {method_name}(self): pass
"""

        elif node.type == 'output':
             # The wrapper handles passing args
            params = []
            
            d_min = node.data.get("min")
            d_max = node.data.get("max")
            if d_min is not None: params.append(f"min={d_min}")
            if d_max is not None: params.append(f"max={d_max}")
            
            if params:
                params_str = ", " + ", ".join(params)
            else:
                params_str = ""

            return f"""
@output_node("{nid}", inputs={dict_str}, label="{label_safe}"{params_str})
def {method_name}(self, {args_str}): pass
"""
        
        return ""

