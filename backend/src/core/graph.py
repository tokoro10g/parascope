from typing import Any, Dict
from uuid import UUID

import networkx as nx

from ..models.sheet import Node, Sheet
from .execution import execute_python_code
from .exceptions import NodeExecutionError


class GraphProcessor:
    def __init__(self, sheet: Sheet):
        self.sheet = sheet
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
            self.graph.add_edge(conn.source_id, conn.target_id, 
                                source_port=conn.source_port, 
                                target_port=conn.target_port)

    def validate(self):
        if not nx.is_directed_acyclic_graph(self.graph):
            raise ValueError("Graph contains cycles")

    def _parse_value(self, val: Any) -> Any:
        try:
            if isinstance(val, str):
                if val.lower() == 'true':
                    return True
                elif val.lower() == 'false':
                    return False
                elif '.' in val:
                    return float(val)
                else:
                    return int(val)
        except ValueError:
            pass
        return val

    def execute(self, input_overrides: Dict[str, Any] = None) -> Dict[UUID, Any]:
        self.validate()
        
        # Topological sort
        execution_order = list(nx.topological_sort(self.graph))
        
        for node_id in execution_order:
            node = self.node_map[node_id]
            self._execute_node(node, input_overrides)
            
        return self.results

    def _execute_node(self, node: Node, input_overrides: Dict[str, Any] = None):
        node_type = node.type
        
        if node_type == "parameter":
            # Return the value defined in data
            # TODO: Handle units (Pint)
            val = node.data.get("value", 0)
            self.results[node.id] = {'value': self._parse_value(val)}
            
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
            
            if val is None:
                val = node.data.get("value", 0)

            self.results[node.id] = {'value': self._parse_value(val)}

        elif node_type == "function":
            # Gather inputs
            inputs = {}
            in_edges = self.graph.in_edges(node.id, data=True)
            
            for u, _v, data in in_edges:
                # data contains 'target_port' which maps to the function argument name
                arg_name = data['target_port']
                inputs[arg_name] = self.results[u][data['source_port']]

            outputs = [o['key'] for o in self.node_map[node.id].outputs]
            
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

        elif node_type == "output":
            # Pass through the value from the source
            in_edges = list(self.graph.in_edges(node.id, data=True))
            if in_edges:
                source_id = in_edges[0][0]
                source_port = in_edges[0][2]['source_port']
                self.results[node.id] = self.results[source_id][source_port]
            else:
                self.results[node.id] = None
        
        elif node_type == "option":
             self.results[node.id] = node.data.get("value")

