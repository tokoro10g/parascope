import type { NodeEditor } from 'rete';
import { api, type NodeResult, type Sheet } from './api';
import type { Schemes } from './rete/types';

export const formatHumanReadableValue = (value: string): string => {
  const valueAsNumber = Number.parseFloat(value);
  if (Number.isNaN(valueAsNumber)) {
    return value;
  }
  if (valueAsNumber === 0) {
    return '0';
  }
  const isTooLong =
    Math.abs(valueAsNumber) >= 1e6 || Math.abs(valueAsNumber) < 1e-3;
  const numberFormat = new Intl.NumberFormat('en-US', {
    maximumSignificantDigits: 6,
    notation: isTooLong ? 'scientific' : 'standard',
    useGrouping: false,
  });
  return numberFormat.format(valueAsNumber).toLowerCase();
};

export const extractValuesFromResult = (
  result: Record<string, NodeResult>,
): Record<string, any> => {
  const values: Record<string, any> = {};
  Object.entries(result).forEach(([id, nodeRes]) => {
    if (nodeRes.outputs?.value !== undefined) {
      values[id] = nodeRes.outputs.value;
    }
  });
  return values;
};

export const createSocket = (key: string) => ({ key, socket_type: 'any' });

export const syncNestedSheets = async (
  sheet: Sheet,
): Promise<{
  updatedNodes: Sheet['nodes'];
  connectionsChanged: boolean;
  validConnectionIds: Set<string>;
}> => {
  const nestedSheetNodes = sheet.nodes.filter(
    (n) => n.type === 'sheet' && n.data?.sheetId,
  );

  if (nestedSheetNodes.length === 0) {
    return {
      updatedNodes: sheet.nodes,
      connectionsChanged: false,
      validConnectionIds: new Set(
        sheet.connections.map((c) => c.id).filter((id): id is string => !!id),
      ),
    };
  }

  const updatedNodes = [...sheet.nodes];
  let connectionsChanged = false;
  const validConnectionIds = new Set(
    sheet.connections.map((c) => c.id).filter((id): id is string => !!id),
  );

  await Promise.all(
    nestedSheetNodes.map(async (node) => {
      try {
        const childSheet = await api.getSheet(node.data.sheetId);

        // Update Inputs (from child's Input nodes)
        const newInputs = childSheet.nodes
          .filter((n) => n.type === 'input')
          .map((n) => createSocket(n.label));

        // Update Outputs (from child's Output nodes and Constant nodes)
        const newOutputs = childSheet.nodes
          .filter((n) => n.type === 'output' || n.type === 'constant')
          .map((n) => ({ key: n.label, socket_type: n.type }));

        // Find the node in the array and update it
        const nodeIndex = updatedNodes.findIndex((n) => n.id === node.id);
        if (nodeIndex !== -1) {
          updatedNodes[nodeIndex] = {
            ...updatedNodes[nodeIndex],
            inputs: newInputs,
            outputs: newOutputs,
          };
        }

        // Validate Connections
        // Remove connections to/from this node that reference non-existent sockets
        const inputKeys = new Set(newInputs.map((i) => i.key));
        const outputKeys = new Set(newOutputs.map((o) => o.key));

        sheet.connections.forEach((c) => {
          if (c.target_id === node.id) {
            if (!inputKeys.has(c.target_port)) {
              if (c.id) validConnectionIds.delete(c.id);
              connectionsChanged = true;
            }
          }
          if (c.source_id === node.id) {
            if (!outputKeys.has(c.source_port)) {
              if (c.id) validConnectionIds.delete(c.id);
              connectionsChanged = true;
            }
          }
        });
      } catch (err) {
        console.error(`Failed to sync nested sheet ${node.data.sheetId}`, err);
      }
    }),
  );

  return { updatedNodes, connectionsChanged, validConnectionIds };
};

export const resolveNestedSheetParams = (
  editor: NodeEditor<Schemes>,
  nodeId: string,
  lastResult: any,
  calculationInputs: any,
): string => {
  const node = editor.getNode(nodeId);
  if (!node?.data?.sheetId) return '';

  const connections = editor
    .getConnections()
    .filter((c) => c.target === nodeId);
  const queryParams = new URLSearchParams();

  connections.forEach((c) => {
    const sourceId = c.source;
    const inputKey = c.targetInput;
    let value: any;

    // 1. Check lastResult (calculated values)
    if (lastResult && sourceId in lastResult) {
      const nodeResult = lastResult[sourceId];
      value = nodeResult?.outputs?.[c.sourceOutput];
    }
    // 2. Check calculationInputs (if source is an input node)
    else if (calculationInputs && sourceId in calculationInputs) {
      value = calculationInputs[sourceId];
    }
    // 3. Check node control value (fallback for constants/inputs)
    else {
      const sourceNode = editor.getNode(sourceId);
      if (sourceNode?.controls?.value) {
        const control = sourceNode.controls.value as any;
        if (control && control.value !== undefined) {
          value = control.value;
        }
      }
    }

    if (value !== undefined) {
      const stringValue =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      queryParams.set(inputKey, stringValue);
    }
  });

  return queryParams.toString();
};

export const fallbackCopy = (text: string) => {
  const textArea = document.createElement('textarea');
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
    console.log('Fallback: Copying text command was successful');
    return true;
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
};

export const validateGraphConnectivity = (graph: {
  nodes: { id?: string; type: string; label: string; inputs: any[] }[];
  connections: { target_id: string; target_port: string }[];
}): { valid: boolean; errors: { nodeId: string; error: string }[] } => {
  const connectionMap = new Set<string>();
  graph.connections.forEach((c) => {
    connectionMap.add(`${c.target_id}:${c.target_port}`);
  });

  const errors: { nodeId: string; error: string }[] = [];

  for (const node of graph.nodes) {
    if (
      ['function', 'output', 'sheet'].includes(node.type) &&
      node.type !== 'comment'
    ) {
      if (!node.inputs) continue;

      for (const input of node.inputs) {
        if (!node.id) continue;
        if (!connectionMap.has(`${node.id}:${input.key}`)) {
          errors.push({
            nodeId: node.id,
            error: `Unconnected input: ${input.key}`,
          });
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
};
