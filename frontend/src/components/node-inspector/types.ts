import type { NodeUpdates } from '../../rete/types';
export type { NodeUpdates };

export interface NodeInspectorProps {
  node: any; // Using any for ParascopeNode to avoid circular deps or complex imports for now, can be refined
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, updates: NodeUpdates) => void;
}
