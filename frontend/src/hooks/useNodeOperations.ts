import { useCallback } from 'react';
import type { AreaPlugin } from 'rete-area-plugin';
import { v4 as uuidv4 } from 'uuid';
import type { Sheet } from '../api';
import type { NodeEditorWrapper } from '../rete';
import { ParascopeNode } from '../rete';
import type { NodeType, NodeUpdates, Schemes } from '../rete/types';
import { createSocket } from '../utils';

export function useNodeOperations(
  wrapper: NodeEditorWrapper | undefined | null,
  area: AreaPlugin<Schemes, any> | undefined,
  nodes: ParascopeNode[],
  setIsDirty: (isDirty: boolean) => void,
  currentSheet: Sheet | null,
) {
  const editor = wrapper?.instance;

  const getUniqueLabel = useCallback(
    (label: string, type: NodeType, excludeNodeId?: string) => {
      const isReservedType =
        type === 'input' || type === 'constant' || type === 'output';
      if (!isReservedType) return label;

      let newLabel = label;
      let counter = 1;

      const exists = (l: string) =>
        nodes.some(
          (n) => n.type === type && n.label === l && n.id !== excludeNodeId,
        );

      while (exists(newLabel)) {
        newLabel = `${label} (${counter})`;
        counter++;
      }

      return newLabel;
    },
    [nodes],
  );

  const calcCenterPosition = useCallback(() => {
    if (!editor || !area) return { x: 0, y: 0 };
    const bounds = area.container.getBoundingClientRect();
    const zoom = area.area.transform.k;
    const x = (bounds.width / 2 - area.area.transform.x) / zoom;
    const y = (bounds.height / 2 - area.area.transform.y) / zoom;
    return { x: x, y: y };
  }, [editor, area]);

  const calcCursorPosition = useCallback(() => {
    if (!area) return { x: 0, y: 0 };
    const { x, y } = area.area.pointer;
    // If pointer has never entered the area, x and y might be 0 or NaN depending on Rete version.
    // We check if they are valid numbers.
    if (Number.isNaN(x) || Number.isNaN(y) || (x === 0 && y === 0)) {
      return calcCenterPosition();
    }
    return { x, y };
  }, [area, calcCenterPosition]);

  const addNode = useCallback(
    async (
      type: NodeType,
      label: string,
      inputs: { key: string; socket_type?: string }[],
      outputs: { key: string; socket_type?: string }[],
      data: Record<string, any>,
      position: { x: number; y: number },
      shouldEdit = false,
      setEditingNode?: (node: ParascopeNode) => void,
    ): Promise<ParascopeNode | undefined> => {
      if (!editor || !area) return;
      const id = uuidv4();

      const uniqueLabel = getUniqueLabel(label, type);

      const node = new ParascopeNode(type, uniqueLabel, inputs, outputs, data);

      node.id = id;
      node.dbId = id;

      await editor.addNode(node);
      await area.translate(node.id, position);

      if (shouldEdit && setEditingNode) {
        setEditingNode(node);
      }

      // No manual setNodes/setCurrentSheet here - handled by Rete events
      setIsDirty(true);
      return node;
    },
    [editor, area, setIsDirty, getUniqueLabel],
  );

  const handleDuplicateNode = useCallback(
    async (nodeId: string) => {
      if (!editor || !area || !currentSheet) return;
      const originalNode = editor.getNode(nodeId);
      if (!originalNode) return;

      const type = originalNode.type;
      const label = originalNode.label;

      const inputs = Object.keys(originalNode.inputs).map(createSocket);
      const outputs = Object.keys(originalNode.outputs).map(createSocket);

      const data = JSON.parse(JSON.stringify(originalNode.data));

      if (originalNode.controls.value) {
        const control = originalNode.controls.value as any;
        if (control && control.value !== undefined) {
          data.value = control.value;
        }
      }

      const originalView = area.nodeViews.get(nodeId);
      const position = originalView
        ? { x: originalView.position.x + 50, y: originalView.position.y + 50 }
        : calcCenterPosition();

      await addNode(type, label, inputs, outputs, data, position);
    },
    [editor, area, currentSheet, calcCenterPosition, addNode],
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
      if (!editor || !area || !wrapper) return;

      const node = editor.getNode(nodeId);
      if (!node) return;

      if (updates.label && updates.label !== node.label) {
        updates.label = getUniqueLabel(
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
        updates.label = getUniqueLabel(
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
    [editor, area, wrapper, getUniqueLabel],
  );

  return {
    addNode,
    removeNode,
    handleDuplicateNode,
    handleNodeUpdate,
    calcCenterPosition,
    calcCursorPosition,
  };
}
