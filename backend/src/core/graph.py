from typing import Any, Dict, Optional
from uuid import UUID

import networkx as nx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.sheet import Node, Sheet
from .exceptions import NodeExecutionError
from .execution import execute_python_code


class GraphProcessor:
    def __init__(self, sheet: Sheet, db: Optional[AsyncSession] = None):
        self.sheet = sheet
        self.db = db
        self.graph = nx.MultiDiGraph()
        self.results: Dict[UUID, Any] = {}
        self.node_map: Dict[UUID, Node] = {node.id: node for node in sheet.nodes}
        self._build_graph()

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

    def _parse_value(self, val: Any) -> Any:
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

    def _validate_option(self, node: Node, value: Any):
        if node.data.get("dataType") == "option":
            options = node.data.get("options", [])
            # Options are strictly strings
            str_value = str(value)
            if str_value not in options:
                raise NodeExecutionError(
                    str(node.id), node.label, f"Value '{value}' is not a valid option. Allowed: {options}"
                )

    def _validate_range(self, node: Node, value: Any):
        if value is None:
            return

        # Only validate numbers
        if not isinstance(value, (int, float)):
            return

        min_val = node.data.get("min")
        max_val = node.data.get("max")

        if min_val is not None and min_val != "":
            try:
                min_val = float(min_val)
                if value < min_val:
                    raise NodeExecutionError(
                        str(node.id), node.label, f"Value {value} is less than minimum {min_val}"
                    )
            except ValueError:
                pass

        if max_val is not None and max_val != "":
            try:
                max_val = float(max_val)
                if value > max_val:
                    raise NodeExecutionError(
                        str(node.id), node.label, f"Value {value} is greater than maximum {max_val}"
                    )
            except ValueError:
                pass

    async def execute(self, input_overrides: Dict[str, Any] = None) -> Dict[UUID, Any]:
        self.validate()

        # Topological sort
        execution_order = list(nx.topological_sort(self.graph))

        for node_id in execution_order:
            node = self.node_map[node_id]
            await self._execute_node(node, input_overrides)

        return self.results

    async def _execute_node(self, node: Node, input_overrides: Dict[str, Any] = None):
        node_type = node.type

        if node_type == "parameter":
            # Return the value defined in data
            val = node.data.get("value", 0)

            if node.data.get("dataType") == "option":
                self._validate_option(node, val)
                # Ensure it's a string
                val = str(val)
            else:
                val = self._parse_value(val)
                self._validate_range(node, val)

            self.results[node.id] = {"value": val}

        elif node_type == "input":
            # Check overrides or default
            val = None

            if input_overrides:
                # Check by ID first (Frontend sends IDs)
                if str(node.id) in input_overrides:
                    val = input_overrides[str(node.id)]
                # Check by Label (URL params might use labels)
                elif node.label in input_overrides:
                    val = input_overrides[node.label]

            if val is None or val == "":
                # Fallback to default value if present (e.g. for testing)
                val = node.data.get("value")

            if val is None or val == "":
                raise NodeExecutionError(str(node.id), node.label, "Input requires a value")

            if node.data.get("dataType") == "option":
                self._validate_option(node, val)
                val = str(val)
            else:
                val = self._parse_value(val)
                self._validate_range(node, val)

            self.results[node.id] = {"value": val}

        elif node_type == "function":
            # Gather inputs
            inputs = {}
            in_edges = self.graph.in_edges(node.id, data=True)

            for u, _v, data in in_edges:
                # data contains 'target_port' which maps to the function argument name
                arg_name = data["target_port"]
                
                if u in self.results and isinstance(self.results[u], dict) and "error" in self.results[u]:
                     raise NodeExecutionError(str(node.id), node.label, f"Dependency '{self.node_map[u].label}' failed")

                inputs[arg_name] = self.results[u][data["source_port"]]

            outputs = [o["key"] for o in self.node_map[node.id].outputs]

            # Execute code
            code = node.data.get("code", "")
            if not code:
                self.results[node.id] = None
                return

            exec_result = execute_python_code(code, inputs, outputs)

            if exec_result.success:
                self.results[node.id] = exec_result.result
            else:
                raise NodeExecutionError(str(node.id), node.label, exec_result.error)

        elif node_type == "sheet":
            if not self.db:
                raise NodeExecutionError(str(node.id), node.label, "Database session required for nested sheets")

            nested_sheet_id = node.data.get("sheetId")
            if not nested_sheet_id:
                raise NodeExecutionError(str(node.id), node.label, "No sheet selected")

            # Fetch nested sheet
            try:
                stmt = (
                    select(Sheet)
                    .where(Sheet.id == UUID(nested_sheet_id))
                    .options(selectinload(Sheet.nodes), selectinload(Sheet.connections))
                )
                result = await self.db.execute(stmt)
                nested_sheet = result.scalar_one_or_none()
            except Exception as e:
                raise NodeExecutionError(str(node.id), node.label, f"Invalid sheet ID: {e}") from e

            if not nested_sheet:
                raise NodeExecutionError(str(node.id), node.label, f"Nested sheet {nested_sheet_id} not found")

            # Prepare inputs
            nested_inputs = {}
            in_edges = self.graph.in_edges(node.id, data=True)
            for u, _v, data in in_edges:
                # target_port on parent node corresponds to Input Node Label in child sheet
                input_label = data["target_port"]
                
                if u in self.results and isinstance(self.results[u], dict) and "error" in self.results[u]:
                     raise NodeExecutionError(str(node.id), node.label, f"Dependency '{self.node_map[u].label}' failed")

                if u in self.results and data["source_port"] in self.results[u]:
                    nested_inputs[input_label] = self.results[u][data["source_port"]]
                else:
                    # Should not happen if topological sort is correct
                    pass

            # Execute nested sheet
            # TODO: Add cycle detection / depth limit
            nested_processor = GraphProcessor(nested_sheet, self.db)
            nested_results = await nested_processor.execute(input_overrides=nested_inputs)

            # Map outputs
            node_outputs = {}
            for n in nested_sheet.nodes:
                if n.type == "output":
                    # The value of the output node
                    if n.id in nested_results:
                        node_outputs[n.label] = nested_results[n.id]

            self.results[node.id] = node_outputs

        elif node_type == "output":
            # Pass through the value from the source
            in_edges = list(self.graph.in_edges(node.id, data=True))
            if in_edges:
                source_id = in_edges[0][0]
                source_port = in_edges[0][2]["source_port"]
                
                if source_id in self.results and isinstance(self.results[source_id], dict) and "error" in self.results[source_id]:
                     raise NodeExecutionError(str(node.id), node.label, f"Dependency '{self.node_map[source_id].label}' failed")

                val = self.results[source_id][source_port]
                
                if node.data.get("dataType") == "option":
                    self._validate_option(node, val)
                else:
                    self._validate_range(node, val)
                
                self.results[node.id] = val
            else:
                self.results[node.id] = None

        elif node_type == "option":
            self.results[node.id] = node.data.get("value")
