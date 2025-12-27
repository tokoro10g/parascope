class NodeExecutionError(Exception):
    """Raised when a node execution fails."""

    def __init__(self, node_id: str, node_label: str, error_message: str):
        self.node_id = node_id
        self.node_label = node_label
        self.error_message = error_message
        super().__init__(f"Error executing node '{node_label}': {error_message}")
