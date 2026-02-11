import { ClassicPreset as Classic, type NodeEditor } from 'rete';
import type { AreaPlugin } from 'rete-area-plugin';
import type { HistoryPlugin } from 'rete-history-plugin';
import type { Sheet } from '../api';
import { createSocket } from '../utils';
import { DropdownControl } from './DropdownControl';
import { InputControl } from './InputControl';
import { ParascopeNode } from './ParascopeNode';
import type { AreaExtra, NodeType, Schemes } from './types';

export function createLoader(
  instance: NodeEditor<Schemes>,
  area: AreaPlugin<Schemes, AreaExtra>,
  history: HistoryPlugin<Schemes>,
  zoomToNode: (nodeId: string) => void,
  zoomToFit: (nodes?: any[]) => Promise<void>,
  selectNode: (nodeId: string, accumulate: boolean) => void,
  setSuppressGraphChange: (suppress: boolean) => void,
) {
  const loadSheet = async (sheet: Sheet, focusNodeId?: string) => {
    setSuppressGraphChange(true);
    try {
      await instance.clear();

      const nodeMap = new Map<string, ParascopeNode>();

      // Create Nodes
      for (const n of sheet.nodes) {
        if (!n.id) continue;
        const inputs = Array.isArray(n.inputs) ? n.inputs : [];
        const outputs = Array.isArray(n.outputs) ? n.outputs : [];

        const node = new ParascopeNode(
          n.type as NodeType,
          n.label || n.type,
          inputs,
          outputs,
          n.data || {},
        );

        node.id = n.id;
        node.dbId = n.id;

        await instance.addNode(node);
        await area.translate(node.id, { x: n.position_x, y: n.position_y });
        nodeMap.set(n.id, node);
      }

      // Create Connections
      for (const c of sheet.connections) {
        if (!c.id) continue;
        const source = nodeMap.get(c.source_id);
        const target = nodeMap.get(c.target_id);

        if (source && target) {
          try {
            // Need access to the Connection class from types.ts
            // But we can use the instance.addConnection directly if we have the nodes
            // The Connection constructor is exported from types.ts
            const { Connection } = await import('./types');
            const conn = new Connection(
              source,
              c.source_port,
              target,
              c.target_port,
            );
            conn.id = c.id;
            conn.dbId = c.id;
            await instance.addConnection(conn);
          } catch (e) {
            console.error('Failed to create connection', c, e);
          }
        }
      }

      history.clear();

      return new Promise<void>((resolve) => {
        setTimeout(async () => {
          for (const node of instance.getNodes()) {
            await area.update('node', node.id);
          }

          if (focusNodeId) {
            const node = instance.getNode(focusNodeId) as ParascopeNode;
            if (node) {
              zoomToNode(node.id);
              selectNode(node.id, false);
            } else {
              await zoomToFit(instance.getNodes() as ParascopeNode[]);
            }
          } else {
            await zoomToFit(instance.getNodes() as ParascopeNode[]);
          }
          resolve();
        }, 200);
      });
    } finally {
      setSuppressGraphChange(false);
    }
  };

  const getGraphData = () => {
    const isUuid = (id: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );

    const allNodes = instance.getNodes();

    const nodes = allNodes.map((n) => {
      const data: Record<string, any> = {};

      for (const [key, control] of Object.entries(n.controls)) {
        if (
          control instanceof Classic.InputControl ||
          control instanceof DropdownControl ||
          control instanceof InputControl
        ) {
          data[key] = (control as any).value ?? '';
        }
      }

      return {
        id: isUuid(n.id) ? n.id : undefined,
        type: n.type,
        label: n.label,
        position_x: area.nodeViews.get(n.id)?.position.x || 0,
        position_y: area.nodeViews.get(n.id)?.position.y || 0,
        inputs: Object.keys(n.inputs).map(createSocket),
        outputs: Object.keys(n.outputs).map(createSocket),
        data: { ...n.data, ...data },
      };
    });

    const connections = instance.getConnections().map((c) => ({
      id: isUuid(c.id) ? c.id : undefined,
      source_id: c.source,
      target_id: c.target,
      source_port: c.sourceOutput,
      target_port: c.targetInput,
    }));

    return { nodes, connections };
  };

  return {
    loadSheet,
    getGraphData,
  };
}
