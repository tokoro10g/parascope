from typing import Any, Dict
from uuid import UUID

import networkx as nx

from ..models.sheet import Node, Sheet
from .execution import execute_python_code


class GraphProcessor:
    def __init__(self, sheet: Sheet):
        self.sheet = sheet
        self.graph = nx.DiGraph()
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
                                source_handle=conn.source_handle, 
                                target_handle=conn.target_handle)

    def validate(self):
        if not nx.is_directed_acyclic_graph(self.graph):
            raise ValueError("Graph contains cycles")

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
            self.results[node.id] = node.data.get("value", 0)
            
        elif node_type == "input":
            # Check overrides or default
            # For now, just use a default or 0
            # In a real scenario, we'd look up the input name in input_overrides
            # Assuming node.label is the input name
            if input_overrides and node.label in input_overrides:
                self.results[node.id] = input_overrides[node.label]
            else:
                self.results[node.id] = node.data.get("value", 0)

        elif node_type == "function":
            # Gather inputs
            inputs = {}
            in_edges = self.graph.in_edges(node.id, data=True)
            
            for u, _v, data in in_edges:
                # data contains 'target_handle' which maps to the function argument name
                arg_name = data['target_handle']
                inputs[arg_name] = self.results[u]
            
            # Execute code
            code = node.data.get("code", "")
            if not code:
                self.results[node.id] = None
                return

            exec_result = execute_python_code(code, inputs)
            
            if exec_result.success:
                self.results[node.id] = exec_result.result
            else:
                # Propagate error? For now, store None or error dict
                # In a real app, we might want to store the error state on the node
                self.results[node.id] = None
                print(f"Error executing node {node.label}: {exec_result.error}")

        elif node_type == "output":
            # Pass through the value from the source
            in_edges = list(self.graph.in_edges(node.id))
            if in_edges:
                source_id = in_edges[0][0]
                self.results[node.id] = self.results.get(source_id)
            else:
                self.results[node.id] = None
        
        elif node_type == "option":
             self.results[node.id] = node.data.get("value")

