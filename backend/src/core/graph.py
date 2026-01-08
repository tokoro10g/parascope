import asyncio
import os
from typing import Any, Dict, Optional
from uuid import UUID

import networkx as nx
from jinja2 import Environment, FileSystemLoader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.sheet import Node, Sheet
from .exceptions import GraphExecutionError
from .execution import execute_full_script


class GraphProcessor:
    def __init__(self, sheet: Sheet, db: Optional[AsyncSession] = None):
        self.sheet = sheet
        self.db = db
        self.graph = nx.MultiDiGraph()
        self.node_map: Dict[UUID, Node] = {node.id: node for node in sheet.nodes}
        self._build_graph()
        
        # Setup Jinja
        template_dir = os.path.join(os.path.dirname(__file__), "templates")
        self.env = Environment(loader=FileSystemLoader(template_dir))

    def _build_graph(self):
        # Add nodes
        for node in self.sheet.nodes:
            self.graph.add_node(node.id, type=node.type, data=node.data)

        # Add edges
        for conn in self.sheet.connections:
            self.graph.add_edge(
                conn.source_id, conn.target_id, source_port=conn.source_port, target_port=conn.target_port
            )

    def validate(self):
        if not nx.is_directed_acyclic_graph(self.graph):
            raise ValueError("Graph contains cycles")

    async def generate_script(self, input_overrides: Dict[str, Any] = None) -> str:
        self.validate()
        
        base_script_path = os.path.join(os.path.dirname(__file__), "script_base.py")
        with open(base_script_path, "r") as f:
            base_script = f.read()
            
        nodes_context = await self._get_nodes_context()
        
        template = self.env.get_template("script.jinja2")
        return template.render(
            base_script=base_script,
            input_overrides=repr(input_overrides or {}),
            nodes=nodes_context
        )

    async def _generate_body_code(self) -> str:
        # For nested sheets
        nodes_context = await self._get_nodes_context()
        template = self.env.get_template("body.jinja2")
        return template.render(
            nodes=nodes_context
        )
        
    async def _get_nodes_context(self):
        execution_order = list(nx.topological_sort(self.graph))
        nodes_context = []
        for node_id in execution_order:
            node = self.node_map[node_id]
            nodes_context.append(await self._prepare_node_context(node))
        return nodes_context

    async def _prepare_node_context(self, node: Node) -> Dict[str, Any]:
        node_id_str = str(node.id)
        # Determine strict type/validation needs
        is_option = node.data.get("dataType") == "option"
        has_range = False
        min_val = None
        max_val = None
        
        if not is_option:
            min_val = node.data.get("min")
            max_val = node.data.get("max")
            # Only consider it a range if values are present strings/numbers
            if (min_val is not None and str(min_val) != "") or (max_val is not None and str(max_val) != ""):
                has_range = True

        ctx = {
            "id": node_id_str,
            "label": node.label,
            "type": node.type,
            "data": repr(node.data),
            "is_option": is_option,
            "has_range": has_range
        }
        
        if node.type == "parameter":
            ctx["value"] = repr(node.data.get("value", 0))
            
        elif node.type == "input":
             ctx["default_value"] = repr(node.data.get("value"))
             
        elif node.type == "output":
            in_edges = list(self.graph.in_edges(node.id, data=True))
            if in_edges:
                ctx["has_source"] = True
                ctx["source_id"] = str(in_edges[0][0])
                ctx["source_port"] = in_edges[0][2]["source_port"]
            else:
                ctx["has_source"] = False
                
        elif node.type == "function":
             input_mapping = {}
             in_edges = self.graph.in_edges(node.id, data=True)
             for u, _v, data in in_edges:
                 input_mapping[data["target_port"]] = (str(u), data["source_port"])
             
             ctx["inputs"] = input_mapping
             ctx["func_name"] = f"func_{node_id_str.replace('-', '_')}"
             ctx["args"] = list(input_mapping.keys())
             
             user_code = node.data.get("code", "")
             ctx["user_code"] = user_code if user_code and user_code.strip() else "pass"
             
             outputs = [o["key"] for o in self.node_map[node.id].outputs]
             ctx["outputs"] = outputs
             
        elif node.type == "sheet":
            if not self.db:
                 raise GraphExecutionError(node_id_str, node.label, "Database session required for nested sheets")

            nested_sheet_id = node.data.get("sheetId")
            if not nested_sheet_id:
                raise ValueError("No sheet selected")

            stmt = (
                select(Sheet)
                .where(Sheet.id == UUID(nested_sheet_id))
                .options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
            )
            result = await self.db.execute(stmt)
            nested_sheet = result.scalar_one_or_none()
            if not nested_sheet:
                 raise ValueError(f"Nested sheet {nested_sheet_id} not found")

            # Inputs mapping
            input_mapping = {} 
            in_edges = self.graph.in_edges(node.id, data=True)
            for u, _v, data in in_edges:
                input_mapping[data["target_port"]] = (str(u), data["source_port"])
            ctx["inputs"] = input_mapping

            # Generate nested code
            nested_processor = GraphProcessor(nested_sheet, self.db)
            ctx["nested_code"] = await nested_processor._generate_body_code()
            
            ctx["func_name"] = f"sheet_{node_id_str.replace('-', '_')}"
            
            # Outputs mapping (id -> label)
            ctx["sheet_outputs"] = []
            for n in nested_sheet.nodes:
                if n.type == "output":
                    ctx["sheet_outputs"].append((str(n.id), n.label))
                    
        return ctx

    async def execute_script(self, script: str) -> Dict[UUID, Any]:
        """
        Executes the generated script and returns the results.
        """
        loop = asyncio.get_running_loop()
        # Use execute_full_script in a separate thread to handle the blocking process call
        # This satisfies EE-01.0 (Background Worker) and EH-11.0 (Timeout)
        result_data = await loop.run_in_executor(None, execute_full_script, script)

        if not result_data.get("success"):
            raise Exception(result_data.get("error", "Execution failed"))

        results = result_data.get("results", {})
        parsed_results = {}
        for k, v in results.items():
            try:
                parsed_results[UUID(k)] = v
            except ValueError:
                pass 
                
        return parsed_results

    async def execute(self, input_overrides: Dict[str, Any] = None) -> Dict[UUID, Any]:
        """
        Legacy execute method that now uses script generation
        """
        script = await self.generate_script(input_overrides)
        return await self.execute_script(script)
