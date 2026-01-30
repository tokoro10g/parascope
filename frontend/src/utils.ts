import { toast } from 'react-hot-toast';
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

export const formatLocalTime = (
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  },
) => {
  const time = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
  return new Date(time).toLocaleString(undefined, options);
};

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

  // Deduplicate requests by creating a unique key for each sheet version config
  const uniqueSheetRequests = new Set<string>();
  nestedSheetNodes.forEach((n) => {
    const sid = n.data?.sheetId;
    const vid = n.data?.versionId;
    if (sid) {
      uniqueSheetRequests.add(`${sid}:${vid || 'draft'}`);
    }
  });

  const sheetDataMap = new Map<string, any>();

  await Promise.all(
    Array.from(uniqueSheetRequests).map(async (key) => {
      const [sid, vid] = key.split(':');
      try {
        if (vid && vid !== 'draft') {
          const v = await api.getVersion(sid, vid);
          if (v.data) {
            sheetDataMap.set(key, v.data);
          }
        } else {
          const s = await api.getSheet(sid);
          sheetDataMap.set(key, s);
        }
      } catch (err) {
        console.error(`Failed to fetch sheet data for ${key}`, err);
      }
    }),
  );

  for (const node of nestedSheetNodes) {
    try {
      const key = `${node.data.sheetId}:${node.data.versionId || 'draft'}`;
      const childSheetData = sheetDataMap.get(key);

      if (!childSheetData) continue;

      const childNodes = Array.isArray(childSheetData.nodes)
        ? childSheetData.nodes
        : [];

      // Update Inputs
      const newInputs = childNodes
        .filter((n: any) => n.type === 'input')
        .map((n: any) => createSocket(n.label));

      // Update Outputs
      const newOutputs = childNodes
        .filter((n: any) => n.type === 'output' || n.type === 'constant')
        .map((n: any) => ({ key: n.label, socket_type: n.type }));

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
      const inputKeys = new Set(newInputs.map((i: any) => i.key));
      const outputKeys = new Set(newOutputs.map((o: any) => o.key));

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
  }

  return { updatedNodes, connectionsChanged, validConnectionIds };
};

/**
 * Constructs a URL for a nested sheet with the given parameters and optional versionId.
 */
export const getNestedSheetUrl = (
  sheetId: string,
  params: URLSearchParams,
  versionId?: string,
): string => {
  const finalParams = new URLSearchParams(params);
  if (versionId) {
    finalParams.set('versionId', versionId);
  }
  const queryString = finalParams.toString();
  return `/sheet/${sheetId}${queryString ? `?${queryString}` : ''}`;
};

/**
 * Resolves the input parameters for a nested sheet node from its connections and results.
 */
export const resolveNestedSheetParams = (
  editor: NodeEditor<Schemes>,
  nodeId: string,
  lastResult: any,
  calculationInputs: any,
): URLSearchParams => {
  const node = editor.getNode(nodeId);
  if (!node?.data?.sheetId) return new URLSearchParams();

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

  return queryParams;
};

export const resolveSheetPorts = (nodes: any[]) => {
  const inputs = nodes
    .filter((n) => n.type === 'input')
    .map((n) => createSocket(n.label));

  const outputs = nodes
    .filter((n) => n.type === 'output' || n.type === 'constant')
    .map((n) => ({
      key: n.label,
      socket_type: n.type,
    }));

  return { inputs, outputs };
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

export const copyToClipboard = (text: string) => {
  try {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    });
  } catch {
    if (fallbackCopy(text)) {
      toast.success('Copied to clipboard');
    } else {
      toast.error('Failed to copy to clipboard');
    }
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
