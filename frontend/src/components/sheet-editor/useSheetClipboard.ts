import { useCallback } from 'react';
import { Connection } from '../../rete/types';

export function useSheetClipboard(
  addNode: any,
  calcCenterPosition: () => { x: number; y: number },
  editor: any, // NodeEditorWrapper
) {
  const handleCopy = useCallback((clipboardData: { nodes: any[]; connections: any[] }) => {
    if (!clipboardData.nodes.length) return;

    const dataToStore = {
      type: 'parascope-nodes',
      ...clipboardData,
    };

    localStorage.setItem('parascope-clipboard', JSON.stringify(dataToStore));
  }, []);

  const handlePaste = useCallback(
    async (providedData?: any) => {
      let clipboardData = providedData;

      // If no data provided via event, try localStorage (cross-tab)
      if (!clipboardData) {
        const stored = localStorage.getItem('parascope-clipboard');
        if (stored) {
          try {
            const data = JSON.parse(stored);
            if (data.type === 'parascope-nodes') {
              clipboardData = data;
            }
          } catch (e) {
            console.error('Failed to parse clipboard data', e);
          }
        }
      }

      if (!clipboardData) return;
      const nodesToPaste = Array.isArray(clipboardData) ? clipboardData : clipboardData.nodes;
      const connectionsToPaste = clipboardData.connections || [];

      if (!nodesToPaste || nodesToPaste.length === 0) return;

      // Calculate center of clipboard nodes
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      nodesToPaste.forEach((n: any) => {
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x);
        maxY = Math.max(maxY, n.position.y);
      });
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const screenCenter = calcCenterPosition();
      const offsetX = screenCenter.x - centerX;
      const offsetY = screenCenter.y - centerY;

      // ID Mapping for connections
      const idMap = new Map<string, string>();

      for (const nodeData of nodesToPaste) {
        const inputs = nodeData.inputs;
        const outputs = nodeData.outputs;
        const data = { ...nodeData.data };
        
        if (nodeData.controls && nodeData.controls.value !== undefined) {
          data.value = nodeData.controls.value;
        }

        const label = nodeData.label;

        const position = {
          x: nodeData.position.x + offsetX,
          y: nodeData.position.y + offsetY,
        };

        const newNode = await addNode(nodeData.type, label, inputs, outputs, data, position);
        if (newNode && nodeData.id) {
          idMap.set(nodeData.id, newNode.id);
        }
      }

      // Recreate internal connections
      if (editor && connectionsToPaste.length > 0) {
        for (const connData of connectionsToPaste) {
          const newSourceId = idMap.get(connData.source);
          const newTargetId = idMap.get(connData.target);

          if (newSourceId && newTargetId) {
            const sourceNode = editor.instance.getNode(newSourceId);
            const targetNode = editor.instance.getNode(newTargetId);

            if (sourceNode && targetNode) {
              try {
                const connection = new Connection(
                  sourceNode,
                  connData.sourceOutput,
                  targetNode,
                  connData.targetInput
                );
                await editor.addConnection(connection);
              } catch (e) {
                console.error("Failed to restore connection during paste", e);
              }
            }
          }
        }
      }
    },
    [addNode, calcCenterPosition, editor],
  );

  return { handleCopy, handlePaste };
}
