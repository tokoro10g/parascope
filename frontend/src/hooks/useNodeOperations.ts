import { useCallback } from 'react';
import type { NodeEditorWrapper, ParascopeNode } from '../rete';
import type { NodeType, NodeUpdates } from '../rete/types';

export function useNodeOperations(
  wrapper: NodeEditorWrapper | undefined | null,
) {
  const editor = wrapper?.instance;

  const addNode = useCallback(
    async (
      type: NodeType,
      label: string,
      inputs: { key: string; socket_type?: string }[],
      outputs: { key: string; socket_type?: string }[],
      data: Record<string, any>,
      position?: { x: number; y: number },
      shouldEdit = false,
      setEditingNode?: (node: ParascopeNode) => void,
    ): Promise<ParascopeNode | undefined> => {
      if (!wrapper) return;

      const node = await wrapper.addNode(
        type,
        label,
        inputs,
        outputs,
        data,
        position,
      );

      if (shouldEdit && setEditingNode) {
        setEditingNode(node);
      }

      return node;
    },
    [wrapper],
  );

  const handleDuplicateNode = useCallback(
    async (nodeId: string) => {
      if (!wrapper) return;
      await wrapper.duplicateNode(nodeId);
    },
    [wrapper],
  );

  const removeNode = useCallback(
    async (nodeId: string) => {
      if (!wrapper) return;
      await wrapper.removeNode(nodeId);
    },
    [wrapper],
  );

  const handleNodeUpdate = useCallback(
    async (nodeId: string, updates: NodeUpdates) => {
      if (!editor || !wrapper) return;

      const node = editor.getNode(nodeId);
      if (!node) return;

      if (updates.label && updates.label !== node.label) {
        updates.label = wrapper.getUniqueLabel(
          updates.label,
          updates.type || node.type,
          nodeId,
        );

        if (node.type === 'input' || node.type === 'output') {
          const isDefaultLabel =
            (node.type === 'input' && node.label === 'Input') ||
            (node.type === 'output' && node.label === 'Output');

          if (!isDefaultLabel) {
            if (
              !window.confirm(
                `Renaming this ${node.type} node may break sheets that use this sheet as a function. Are you sure?`,
              )
            ) {
              return;
            }
          }
        }
      }

      if (updates.type && updates.type !== node.type) {
        updates.label = wrapper.getUniqueLabel(
          updates.label || node.label,
          updates.type,
          nodeId,
        );

        if (node.type === 'input') {
          // An input node is going to be switched to a constant node. Warn the user.
          if (
            !window.confirm(
              `Switching this ${node.type} node to ${updates.type} node may break sheets that use this sheet as a function. Are you sure?`,
            )
          ) {
            return;
          }
        }
      }

      await wrapper.updateNode(nodeId, updates);
    },
    [editor, wrapper],
  );

  return {
    addNode,
    removeNode,
    handleDuplicateNode,
    handleNodeUpdate,
    calcCenterPosition: () => wrapper?.calcCenterPosition() || { x: 0, y: 0 },
    calcCursorPosition: () => wrapper?.calcCursorPosition() || { x: 0, y: 0 },
  };
}
