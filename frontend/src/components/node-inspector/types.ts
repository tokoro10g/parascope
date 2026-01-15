export interface NodeUpdates {
  type?: string;
  label?: string;
  data?: Record<string, any>;
  inputs?: { key: string; socket_type: string }[];
  outputs?: { key: string; socket_type: string }[];
}

export interface NodeInspectorProps {
  node: any; // Using any for ParascopeNode to avoid circular deps or complex imports for now, can be refined
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, updates: NodeUpdates) => void;
}
