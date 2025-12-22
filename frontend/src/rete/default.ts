import { createRoot } from 'react-dom/client';
import { ClassicPreset as Classic, type GetSchemes, NodeEditor } from 'rete';
import { type Area2D, AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import {
  ConnectionPlugin,
  Presets as ConnectionPresets,
} from 'rete-connection-plugin';
import {
  ConnectionPathPlugin /* , Transformers */,
} from 'rete-connection-path-plugin';
import {
  type ReactArea2D,
  ReactPlugin,
  Presets as ReactPresets,
} from 'rete-react-plugin';
import type { Sheet } from '../api';

// --- Types ---

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

    // Add a control to display value if present
    // Input nodes should NOT have a value control (values come from Evaluator/URL)
    if (data.value !== undefined && type !== 'input') {
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

const socket = new Classic.Socket('socket');

export async function createEditor(container: HTMLElement) {
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const reactRender = new ReactPlugin<Schemes, AreaExtra>({ createRoot });

  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl(),
  });
  const pathPlugin = new ConnectionPathPlugin<Schemes, Area2D<Schemes>>({
    // transformer: () => Transformers.classic({ vertical: false }),
    arrow: () => true,
  });
  reactRender.use(pathPlugin);

  connection.addPreset(ConnectionPresets.classic.setup());
  reactRender.addPreset(ReactPresets.classic.setup());

  editor.use(area);
  area.use(connection);
  area.use(reactRender);

  AreaExtensions.zoomAt(area, editor.getNodes());
  area.addPipe(context => {
    if (context.type ===  'zoom' && context.data.source === 'dblclick') return
    return context
  })

  return {
    editor,
    area,
    destroy: () => area.destroy(),

    // Helper to load a sheet from the API
    loadSheet: async (sheet: Sheet) => {
      await editor.clear();

      const nodeMap = new Map<string, ParascopeNode>();

      // Create Nodes
      for (const n of sheet.nodes) {
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

      setTimeout(() => AreaExtensions.zoomAt(area, editor.getNodes()), 100);
    },

    // Helper to get current graph state
    getGraphData: () => {
      const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      const nodes = editor.getNodes().map((n) => {
        const data: Record<string, any> = {};
        
        // Capture control values
        for (const [key, control] of Object.entries(n.controls)) {
            if (control instanceof Classic.InputControl) {
                data[key] = control.value;
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
  };
}
