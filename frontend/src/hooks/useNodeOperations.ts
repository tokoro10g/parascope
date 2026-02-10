import { useCallback } from 'react';
import { ClassicPreset as Classic } from 'rete';
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
  handleCalculationInputChange: (id: string, value: string) => void,
  addHistoryAction?: (action: {
    redo: () => Promise<void> | void;
    undo: () => Promise<void> | void;
  }) => void,
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

      node.onChange = (_val) => {
        // No-op on change to prevent heavy auto-calc on every keystroke
      };

      node.onCommit = (oldVal, newVal) => {
        if (oldVal === newVal) return;

        // Trigger calculation and state updates only when value is committed (blur/Enter)
        if (node.type === 'input') {
          handleCalculationInputChange(id, String(newVal));
        } else {
          setIsDirty(true);
          wrapper?.triggerGraphChange();
        }

        if (node.type !== 'input' && addHistoryAction) {
          addHistoryAction({
            redo: () => {
              const n = editor.getNode(id);
              const control = n?.controls.value as any; // InputControl
              if (control) {
                control.setValue(newVal);
                wrapper?.triggerGraphChange();
              }
            },
            undo: () => {
              const n = editor.getNode(id);
              const control = n?.controls.value as any; // InputControl
              if (control) {
                control.setValue(oldVal);
                wrapper?.triggerGraphChange();
              }
            },
          });
        }
      };

      node.setupControl();

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
    [
      editor,
      area,
      handleCalculationInputChange,
      setIsDirty,
      wrapper,
      getUniqueLabel,
      addHistoryAction,
    ],
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
      if (!editor) return;
      const node = editor.getNode(nodeId);
      if (!node) return;

      const connections = editor.getConnections().filter((c) => {
        return c.source === nodeId || c.target === nodeId;
      });
      for (const c of connections) {
        await editor.removeConnection(c.id);
      }

      await editor.removeNode(nodeId);
      setIsDirty(true);
    },
    [editor, setIsDirty],
  );

  const handleNodeUpdate = useCallback(
    async (nodeId: string, updates: NodeUpdates) => {
      if (!editor || !area) return;

      const node = editor.getNode(nodeId);
      if (!node) return;

      // Capture old state for Undo
      const oldState: NodeUpdates = {
        label: node.label,
        type: node.type,
        data: JSON.parse(JSON.stringify(node.data)),
        inputs: Object.keys(node.inputs).map((key) => ({
          key,
        })),
        outputs: Object.keys(node.outputs).map((key) => ({
          key,
        })),
      };

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

      const applyUpdates = async (
        n: ParascopeNode,
        u: NodeUpdates,
        replaceData = false,
      ) => {
        if (u.label !== undefined) n.label = u.label;
        if (u.type !== undefined) {
          n.type = u.type;
          n.setupControl();
        }
        if (u.data) {
          if (replaceData) {
            n.data = { ...u.data };
          } else {
            n.data = { ...n.data, ...u.data };
          }
          n.setupControl();
        }

        const syncSockets = async (
          socketUpdates: { key: string }[],
          isInput: boolean,
        ) => {
          const currentSockets = isInput ? n.inputs : n.outputs;
          const newKeys = new Set(socketUpdates.map((i) => i.key));
          const keysToRemove = Object.keys(currentSockets).filter(
            (key) => !newKeys.has(key),
          );

          for (const key of keysToRemove) {
            const connections = editor
              .getConnections()
              .filter((c) =>
                isInput
                  ? c.target === n.id && c.targetInput === key
                  : c.source === n.id && c.sourceOutput === key,
              );
            for (const c of connections) {
              await editor.removeConnection(c.id);
            }
            if (isInput) n.removeInput(key);
            else n.removeOutput(key);
          }

          socketUpdates.forEach((item) => {
            const sockets = isInput ? n.inputs : n.outputs;
            if (!sockets[item.key]) {
              let socketName = 'socket';
              if (!isInput && n.type === 'sheet') {
                socketName =
                  (item as any).socket_type === 'constant'
                    ? 'socket-constant'
                    : 'socket-output';
              }
              const s = new Classic.Socket(socketName);
              (s as any).portKey = item.key;
              (s as any).isOutput = !isInput;

              if (isInput) n.addInput(item.key, new Classic.Input(s, item.key));
              else n.addOutput(item.key, new Classic.Output(s, item.key));
            }
          });

          const orderedSockets: Record<string, any> = {};
          socketUpdates.forEach((item) => {
            const sockets = isInput ? n.inputs : n.outputs;
            if (sockets[item.key]) {
              orderedSockets[item.key] = sockets[item.key];
            }
          });

          if (isInput) n.inputs = orderedSockets;
          else n.outputs = orderedSockets;
        };

        if (u.inputs) {
          await syncSockets(u.inputs, true);
        }

        if (u.outputs) {
          await syncSockets(u.outputs, false);
        }

        await area.update('node', n.id);
      };

      await applyUpdates(node, updates);

      setIsDirty(true);
      wrapper?.triggerGraphChange(); // Notify listeners

      if (addHistoryAction) {
        addHistoryAction({
          undo: async () => {
            const n = editor.getNode(nodeId);
            if (!n) return;
            await applyUpdates(n, oldState, true);
            wrapper?.triggerGraphChange();
          },
          redo: async () => {
            const n = editor.getNode(nodeId);
            if (!n) return;
            await applyUpdates(n, updates, false);
            wrapper?.triggerGraphChange();
          },
        });
      }
    },
    [editor, area, setIsDirty, addHistoryAction, wrapper, getUniqueLabel],
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
