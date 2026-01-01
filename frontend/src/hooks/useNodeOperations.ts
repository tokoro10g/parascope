import { useCallback } from 'react';
import type { NodeEditor } from 'rete';
import { ClassicPreset as Classic } from 'rete';
import type { AreaPlugin } from 'rete-area-plugin';
import { v4 as uuidv4 } from 'uuid';
import type { Sheet } from '../api';
import { ParascopeNode, socket } from '../rete';
import type { Schemes } from '../rete/types';
import { createSocket } from '../utils';

export interface NodeUpdates {
  label?: string;
  type?: string;
  initialData?: Record<string, any>;
  inputs?: { key: string; socket_type: string }[];
  outputs?: { key: string; socket_type: string }[];
}

export function useNodeOperations(
  editor: NodeEditor<Schemes> | undefined,
  area: AreaPlugin<Schemes, any> | undefined,
  nodes: ParascopeNode[],
  setNodes: (nodes: ParascopeNode[]) => void,
  setIsDirty: (isDirty: boolean) => void,
  setCurrentSheet: React.Dispatch<React.SetStateAction<Sheet | null>>,
  currentSheet: Sheet | null,
  handleEvaluatorInputChange: (id: string, value: string) => void,
) {
  const calcCenterPosition = useCallback(() => {
    if (!editor || !area) return { x: 0, y: 0 };
    const bounds = area.container.getBoundingClientRect();
    const zoom = area.area.transform.k;
    const x = (bounds.width / 2 - area.area.transform.x) / zoom;
    const y = (bounds.height / 2 - area.area.transform.y) / zoom;
    return { x: x, y: y };
  }, [editor, area]);

  const addNode = useCallback(
    async (
      type: string,
      label: string,
      inputs: { key: string; socket_type: string }[],
      outputs: { key: string; socket_type: string }[],
      data: Record<string, any>,
      position: { x: number; y: number },
      shouldEdit = false,
      setEditingNode?: (node: ParascopeNode) => void,
    ) => {
      if (!editor || !area) return;
      const id = uuidv4();

      const node = new ParascopeNode(
        type,
        label,
        inputs,
        outputs,
        data,
        (val) => {
          if (type === 'input') {
            handleEvaluatorInputChange(id, String(val));
          } else {
            setIsDirty(true);
          }
        },
      );
      node.id = id;
      node.dbId = id;

      await editor.addNode(node);
      await area.translate(node.id, position);

      if (shouldEdit && setEditingNode) {
        setEditingNode(node);
      }

      const newNodeData = {
        id,
        type,
        label,
        position_x: position.x,
        position_y: position.y,
        inputs,
        outputs,
        data,
      };

      setCurrentSheet((prev) =>
        prev
          ? {
              ...prev,
              nodes: [...prev.nodes, newNodeData],
            }
          : null,
      );
      setNodes([...editor.getNodes()]);
      setIsDirty(true);
    },
    [
      editor,
      area,
      handleEvaluatorInputChange,
      setCurrentSheet,
      setNodes,
      setIsDirty,
    ],
  );

  const handleDuplicateNode = useCallback(
    async (nodeId: string) => {
      if (!editor || !area || !currentSheet) return;
      const originalNode = editor.getNode(nodeId);
      if (!originalNode) return;

      const type = originalNode.type;
      const label = `${originalNode.label} (copy)`;

      const inputs = Object.keys(originalNode.inputs).map(createSocket);
      const outputs = Object.keys(originalNode.outputs).map(createSocket);

      const data = JSON.parse(JSON.stringify(originalNode.initialData));

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

  const handleNodeUpdate = useCallback(
    async (nodeId: string, updates: NodeUpdates) => {
      if (!editor || !area) return;

      const node = editor.getNode(nodeId);
      if (!node) return;

      if (updates.label && updates.label !== node.label) {
        // Check for duplicate input/output names
        if (node.type === 'input' || node.type === 'output') {
          const existingNode = nodes.find(
            (n) =>
              n.type === node.type &&
              n.label === updates.label &&
              n.id !== nodeId,
          );
          if (existingNode) {
            alert(
              `An ${node.type} node with the name "${updates.label}" already exists.`,
            );
            return;
          }
        }

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
        node.label = updates.label;
      }

      if (updates.type && updates.type !== node.type) {
        const existingNode = nodes.find(
          (n) =>
            n.type === updates.type &&
            n.label === node.label &&
            n.id !== nodeId,
        );
        if (existingNode) {
          alert(
            `An ${updates.type} node with the name "${node.label}" already exists.`,
          );
          return;
        }
        if (node.type === 'input') {
          // An input node is going to be switched to a parameter node. Warn the user.
          if (
            !window.confirm(
              `Switching this ${node.type} node to ${updates.type} node may break sheets that use this sheet as a function. Are you sure?`,
            )
          ) {
            return;
          }
        }
        node.type = updates.type;
        node.setupControl();
      }

      if (updates.initialData) {
        node.initialData = { ...node.initialData, ...updates.initialData };
        node.setupControl();
      }

      const syncSockets = async (
        updates: { key: string }[],
        isInput: boolean,
      ) => {
        const currentSockets = isInput ? node.inputs : node.outputs;
        const newKeys = new Set(updates.map((i) => i.key));
        const keysToRemove = Object.keys(currentSockets).filter(
          (key) => !newKeys.has(key),
        );

        for (const key of keysToRemove) {
          const connections = editor
            .getConnections()
            .filter((c) =>
              isInput
                ? c.target === nodeId && c.targetInput === key
                : c.source === nodeId && c.sourceOutput === key,
            );
          for (const c of connections) {
            await editor.removeConnection(c.id);
          }
          if (isInput) node.removeInput(key);
          else node.removeOutput(key);
        }

        updates.forEach((item) => {
          const sockets = isInput ? node.inputs : node.outputs;
          if (!sockets[item.key]) {
            if (isInput)
              node.addInput(item.key, new Classic.Input(socket, item.key));
            else node.addOutput(item.key, new Classic.Output(socket, item.key));
          }
        });

        const orderedSockets: Record<string, any> = {};
        updates.forEach((item) => {
          const sockets = isInput ? node.inputs : node.outputs;
          if (sockets[item.key]) {
            orderedSockets[item.key] = sockets[item.key];
          }
        });

        if (isInput) node.inputs = orderedSockets;
        else node.outputs = orderedSockets;
      };

      if (updates.inputs) {
        await syncSockets(updates.inputs, true);
      }

      if (updates.outputs) {
        await syncSockets(updates.outputs, false);
      }

      await area.update('node', nodeId);

      setIsDirty(true);

      // We need to get graph data to update currentSheet, but getGraphData is on the 'editor' object returned by useRete,
      // which is a wrapper. The 'editor' passed here is the Rete NodeEditor instance.
      // The wrapper has getGraphData helper.
      // But we can reconstruct it or pass the wrapper.
      // For now, let's just update nodes list.
      // The original code used editor.getGraphData() which was the helper.
      // We might need to pass that helper or replicate it.
      // Replicating it is safer for decoupling.

      // Actually, let's just update the nodes state for now, and let save handle the full graph data.
      // But currentSheet.nodes needs to be updated for persistence if we save immediately?
      // No, handleSaveSheet calls getGraphData.
      // So we just need to update currentSheet.nodes to keep it in sync for other things?
      // The original code did:
      // const graphData = editor.getGraphData();
      // setCurrentSheet((prev) => prev ? { ...prev, nodes: graphData.nodes } : null);

      // We can skip updating currentSheet.nodes here if we trust editor.getNodes() is the source of truth for the visual graph.
      // But let's try to keep it consistent.

      setNodes([...editor.getNodes()]);
    },
    [editor, area, nodes, setIsDirty, setNodes],
  );

  return {
    addNode,
    handleDuplicateNode,
    handleNodeUpdate,
    calcCenterPosition,
  };
}
