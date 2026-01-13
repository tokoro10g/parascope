import { useCallback } from 'react';
import { createSocket } from '../../utils';

export function useSheetClipboard(
  addNode: any, // Typed as any in original to facilitate quick move
  calcCenterPosition: () => { x: number; y: number }
) {
  const handlePaste = useCallback(
    async (clipboardNodes: any[]) => {
      if (!clipboardNodes.length) return;

      // Calculate center of clipboard nodes
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      clipboardNodes.forEach((n) => {
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

      for (const nodeData of clipboardNodes) {
        const inputs = nodeData.inputs.map((label: string) => createSocket(label)); // Original used createSocket callback logic differently?
        // Wait, original: const inputs = nodeData.inputs.map(createSocket);
        // createSocket takes a label string.
        
        const outputs = nodeData.outputs.map((label: string) => createSocket(label));
        const data = nodeData.initialData;
        if (nodeData.controls && nodeData.controls.value !== undefined) {
          data.value = nodeData.controls.value;
        }

        const label = nodeData.label;

        const position = {
          x: nodeData.position.x + offsetX,
          y: nodeData.position.y + offsetY,
        };

        await addNode(nodeData.type, label, inputs, outputs, data, position);
      }
    },
    [addNode, calcCenterPosition],
  );

  return { handlePaste };
}
