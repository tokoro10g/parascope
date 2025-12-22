import { createRoot } from 'react-dom/client';
import { ClassicPreset as Classic, type GetSchemes, NodeEditor } from 'rete';
import { type Area2D, AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import {
  ConnectionPlugin,
  Presets as ConnectionPresets,
} from 'rete-connection-plugin';
import {
  ConnectionPathPlugin,
} from 'rete-connection-path-plugin';
import {
  type ReactArea2D,
  ReactPlugin,
  Presets as ReactPresets,
} from 'rete-react-plugin';
import type { Sheet } from '../api';

import { CustomNode } from './CustomNode';

// --- Types ---

export const socket = new Classic.Socket('socket');

export class ParascopeNode extends Classic.Node {
  width = 180;
  height = 150;
  public dbId?: string; // ID from the database
  public type: string;
  public initialData: Record<string, any>;

  constructor(
    type: string,
    label: string,
    inputs: { key: string; socket_type: string }[],
    outputs: { key: string; socket_type: string }[],
    data: Record<string, any> = {},
  ) {
    super(label);
    this.type = type;
    this.initialData = data;

    inputs.forEach((inp) => {
      this.addInput(inp.key, new Classic.Input(socket, inp.key));
    });

    outputs.forEach((out) => {
      this.addOutput(out.key, new Classic.Output(socket, out.key));
    });

    // Add a control to display value
    if (type === 'input' || type === 'output') {
        this.addControl(
            'value',
            new Classic.InputControl('text', {
                initial: '',
                readonly: true,
            })
        );
    } else if (data.value !== undefined) {
      this.addControl(
        'value',
        new Classic.InputControl('text', {
          initial: String(data.value),
          readonly: false,
        }),
      );
    }
  }
}

class Connection<
  A extends ParascopeNode,
  B extends ParascopeNode,
> extends Classic.Connection<A, B> {
  public dbId?: string;
}

type Schemes = GetSchemes<
  ParascopeNode,
  Connection<ParascopeNode, ParascopeNode>
>;

type AreaExtra = Area2D<Schemes> | ReactArea2D<Schemes>;


export async function createEditor(container: HTMLElement) {
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const reactRender = new ReactPlugin<Schemes, AreaExtra>({ createRoot });

  // We need to expose a way to set the callback later, or pass it in.
  // Since useRete calls this, we can attach it to the returned object.
  let onNodeDoubleClick: ((nodeId: string) => void) | undefined;

  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl(),
  });
  const pathPlugin = new ConnectionPathPlugin<Schemes, Area2D<Schemes>>({
    arrow: () => true,
  });
  reactRender.use(pathPlugin);

  connection.addPreset(ConnectionPresets.classic.setup());
  reactRender.addPreset(ReactPresets.classic.setup({
    customize: {
      node: () => {
          return CustomNode;
      },
    },
  }));

  editor.use(area);
  area.use(connection);
  area.use(reactRender);

  AreaExtensions.zoomAt(area, editor.getNodes());
  
  let lastNodePicked: string | null = null;
  let lastNodePickedTime = 0;

  area.addPipe(context => {
    if (context.type === 'nodepicked') {
        const nodeId = context.data.id;
        const now = Date.now();
        if (lastNodePicked === nodeId && now - lastNodePickedTime < 300) {
            if (onNodeDoubleClick) {
                onNodeDoubleClick(nodeId);
            }
        }
        lastNodePicked = nodeId;
        lastNodePickedTime = now;
    }
    if (context.type ===  'zoom' && context.data.source === 'dblclick') return
    return context
  })

  return {
    editor,
    area,
    destroy: () => area.destroy(),
    setNodeDoubleClickListener: (cb: (nodeId: string) => void) => {
        onNodeDoubleClick = cb;
    },

    // Helper to load a sheet from the API
    loadSheet: async (sheet: Sheet, focusNodeId?: string) => {
      await editor.clear();

      const nodeMap = new Map<string, ParascopeNode>();

      // Create Nodes
      for (const n of sheet.nodes) {
        if (!n.id) continue;
        // Parse inputs/outputs if they are JSON strings, or use them directly if objects
        const inputs = Array.isArray(n.inputs) ? n.inputs : [];
        const outputs = Array.isArray(n.outputs) ? n.outputs : [];

        const node = new ParascopeNode(n.type, n.label || n.type, inputs, outputs, n.data || {});
        node.id = n.id; // Use the DB ID as the Rete ID
        node.dbId = n.id;
        // node.label is already set by super(label)

        await editor.addNode(node);

        // Translate position
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
            const conn = new Connection(
              source,
              c.source_port,
              target,
              c.target_port,
            );
            conn.id = c.id;
            conn.dbId = c.id;
            await editor.addConnection(conn);
          } catch (e) {
            console.error('Failed to create connection', c, e);
          }
        }
      }

      setTimeout(async () => {
        // Force update nodes to recalculate socket positions after auto-sizing
        for (const node of editor.getNodes()) {
            await area.update('node', node.id);
        }
        
        if (focusNodeId) {
            const node = editor.getNode(focusNodeId);
            if (node) {
                AreaExtensions.zoomAt(area, [node]);
            } else {
                AreaExtensions.zoomAt(area, editor.getNodes());
            }
        } else {
            AreaExtensions.zoomAt(area, editor.getNodes());
        }
      }, 200);
    },

    // Helper to get current graph state
    getGraphData: () => {
      const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      const nodes = editor.getNodes().map((n) => {
        const data: Record<string, any> = {};
        
        // Capture control values
        for (const [key, control] of Object.entries(n.controls)) {
            if (control instanceof Classic.InputControl) {
                // Don't save values for input/output nodes as they are transient
                if (n.type !== 'input' && n.type !== 'output') {
                    data[key] = control.value;
                }
            }
        }

        // Preserve original data if not overwritten by controls
        return {
            id: isUuid(n.id) ? n.id : undefined,
            type: n.type,
            label: n.label,
            position_x: area.nodeViews.get(n.id)?.position.x || 0,
            position_y: area.nodeViews.get(n.id)?.position.y || 0,
            inputs: Object.keys(n.inputs).map((k) => ({
            key: k,
            socket_type: 'any',
            })),
            outputs: Object.keys(n.outputs).map((k) => ({
            key: k,
            socket_type: 'any',
            })),
            data: { ...n.initialData, ...data }, 
        };
      });

      const connections = editor.getConnections().map((c) => ({
        id: isUuid(c.id) ? c.id : undefined,
        source_id: c.source,
        target_id: c.target,
        source_port: c.sourceOutput,
        target_port: c.targetInput,
      }));

      return { nodes, connections };
    },

    updateNodeValues: (inputs: Record<string, any>, outputs: Record<string, any>) => {
        editor.getNodes().forEach(node => {
            const control = node.controls.value as Classic.InputControl<'text'>;
            if (!control) return;

            if (node.type === 'input') {
                const val = inputs[node.id] !== undefined ? inputs[node.id] : '';
                control.setValue(String(val));
                area.update('node', node.id);
            } else if (node.type === 'output') {
                const val = outputs[node.id] !== undefined ? outputs[node.id] : '';
                control.setValue(String(val));
                area.update('node', node.id);
            }
        });
    },

    zoomToNode: (nodeId: string) => {
        const node = editor.getNode(nodeId);
        if (node) {
            AreaExtensions.zoomAt(area, [node]);
        }
    }
  };
}
