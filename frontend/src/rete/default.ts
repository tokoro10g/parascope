import { createRoot } from 'react-dom/client';
import { ClassicPreset as Classic, NodeEditor } from 'rete';
import { type Area2D, AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import { ConnectionPathPlugin } from 'rete-connection-path-plugin';
import {
  ConnectionPlugin,
  Presets as ConnectionPresets,
} from 'rete-connection-plugin';
import type { ContextMenuExtra } from 'rete-context-menu-plugin';
import { HistoryPlugin, Presets as HistoryPresets } from 'rete-history-plugin';
import {
  type ReactArea2D,
  ReactPlugin,
  Presets as ReactPresets,
} from 'rete-react-plugin';
import type { Sheet } from '../api';
import { createSocket } from '../utils';

import { CustomItem, CustomMenu, CustomSearch } from './ContextMenuStyles';
import { CustomNode } from './CustomNode';
import {
  type ContextMenuCallbacks,
  createContextMenuPlugin,
} from './contextMenu';
import { DropdownControl, DropdownControlComponent } from './DropdownControl';
import { InputControl, InputControlComponent } from './InputControl';
import { ParascopeNode } from './ParascopeNode';
import { Connection, type Schemes } from './types';

// --- Types ---

const { Common, Subitems } = ReactPresets.contextMenu;

type AreaExtra = Area2D<Schemes> | ReactArea2D<Schemes> | ContextMenuExtra;

export type NodeEditorWrapper = Awaited<ReturnType<typeof createEditor>>;

export async function createEditor(container: HTMLElement) {
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const reactRender = new ReactPlugin<Schemes, AreaExtra>({ createRoot });
  const history = new HistoryPlugin<Schemes>();
  history.addPreset(HistoryPresets.classic.setup());

  const contextMenuCallbacks: ContextMenuCallbacks = {};
  const contextMenu = createContextMenuPlugin(editor, contextMenuCallbacks);

  // We need to expose a way to set the callback later, or pass it in.
  // Since useRete calls this, we can attach it to the returned object.
  let onNodeDoubleClick: ((nodeId: string) => void) | undefined;
  let onGraphChange: (() => void) | undefined;
  let onInputValueChange: ((nodeId: string, value: string) => void) | undefined;

  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl(),
  });
  const pathPlugin = new ConnectionPathPlugin<Schemes, Area2D<Schemes>>({
    arrow: () => true,
  });
  reactRender.use(pathPlugin);

  connection.addPreset(ConnectionPresets.classic.setup());
  reactRender.addPreset(
    ReactPresets.classic.setup({
      customize: {
        node: () => {
          return CustomNode;
        },
        control: (data) => {
          if (data.payload instanceof DropdownControl) {
            return DropdownControlComponent as any;
          }
          if (data.payload instanceof InputControl) {
            return InputControlComponent as any;
          }
          return ReactPresets.classic.Control;
        },
      },
    }),
  );
  reactRender.addPreset(
    ReactPresets.contextMenu.setup({
      customize: {
        main: () => CustomMenu,
        item: () => CustomItem,
        search: () => CustomSearch,
        common: () => Common,
        subitems: () => Subitems,
      },
    }),
  );

  // Listen for changes
  editor.addPipe((context) => {
    if (
      context.type === 'connectioncreated' ||
      context.type === 'connectionremoved' ||
      context.type === 'nodecreated' ||
      context.type === 'noderemoved'
    ) {
      if (onGraphChange) onGraphChange();
    }
    return context;
  });

  area.addPipe((context) => {
    if (context.type === 'nodetranslated') {
      const { previous, position } = context.data;
      if (previous.x !== position.x || previous.y !== position.y) {
        if (onGraphChange) onGraphChange();
      }
    }
    return context;
  });

  editor.use(area);
  area.use(connection);
  area.use(reactRender);
  area.use(history);
  area.use(contextMenu);

  AreaExtensions.zoomAt(area, editor.getNodes());
  AreaExtensions.snapGrid(area, { size: 20 });

  let lastNodePicked: string | null = null;
  let lastNodePickedTime = 0;

  area.addPipe((context) => {
    if (context.type === 'nodepicked') {
      const nodeId = context.data.id;
      const now = Date.now();
      if (lastNodePicked === nodeId && now - lastNodePickedTime < 300) {
        if (onNodeDoubleClick) {
          const callback = onNodeDoubleClick;
          // Wait for mouse release to avoid sticky drag state
          window.addEventListener(
            'pointerup',
            () => {
              callback(nodeId);
            },
            { once: true }
          );
        }
      } else {
        lastNodePicked = nodeId;
        lastNodePickedTime = now;
      }
    }
    if (context.type === 'zoom' && context.data.source === 'dblclick') return;
    return context;
  });

  return {
    editor,
    area,
    destroy: () => area.destroy(),
    setNodeDoubleClickListener: (cb: (nodeId: string) => void) => {
      onNodeDoubleClick = cb;
    },
    setContextMenuCallbacks: (callbacks: ContextMenuCallbacks) => {
      Object.assign(contextMenuCallbacks, callbacks);
    },
    setGraphChangeListener: (cb: () => void) => {
      onGraphChange = cb;
    },
    setInputValueChangeListener: (
      cb: (nodeId: string, value: string) => void,
    ) => {
      onInputValueChange = cb;
    },
    undo: () => history.undo(),
    redo: () => history.redo(),
    addHistoryAction: (action: {
      redo: () => Promise<void> | void;
      undo: () => Promise<void> | void;
    }) => {
      history.add(action);
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

        const node = new ParascopeNode(
          n.type,
          n.label || n.type,
          inputs,
          outputs,
          n.data || {},
          (val) => {
            if (n.type === 'input') {
              if (onInputValueChange && n.id)
                onInputValueChange(n.id, String(val));
            } else {
              if (onGraphChange) onGraphChange();
            }
          },
        );
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
      // Clear history to prevent undoing sheet loading
      history.clear();

      return new Promise<void>((resolve) => {
        setTimeout(async () => {
          // Force update nodes to recalculate socket positions after auto-sizing
          for (const node of editor.getNodes()) {
            await area.update('node', node.id);
          }

          if (focusNodeId) {
            const node = editor.getNode(focusNodeId);
            if (node) {
              await AreaExtensions.zoomAt(area, [node]);
            } else {
              await AreaExtensions.zoomAt(area, editor.getNodes());
            }
          } else {
            await AreaExtensions.zoomAt(area, editor.getNodes());
          }
          resolve();
        }, 200);
      });
    },

    // Helper to get current graph state
    getGraphData: () => {
      const isUuid = (id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        );

      const nodes = editor.getNodes().map((n) => {
        const data: Record<string, any> = {};

        // Capture control values
        for (const [key, control] of Object.entries(n.controls)) {
          if (
            control instanceof Classic.InputControl ||
            control instanceof DropdownControl ||
            control instanceof InputControl
          ) {
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
          inputs: Object.keys(n.inputs).map(createSocket),
          outputs: Object.keys(n.outputs).map(createSocket),
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

    updateNodeValues: (
      inputs: Record<string, any>,
      outputs: Record<string, any>,
    ) => {
      editor.getNodes().forEach((node) => {
        const valueControl = node.controls
          .value as Classic.InputControl<'text'>;
        if (!valueControl) return;

        if (node.type === 'input') {
          if (Object.hasOwn(inputs, node.id)) {
            const val = inputs[node.id];
            const newVal = String(val !== undefined && val !== null ? val : '');
            if (valueControl.value !== newVal) {
              valueControl.setValue(newVal);
              area.update('node', node.id);
            }
          }
        } else if (node.type === 'output') {
          if (Object.hasOwn(outputs, node.id)) {
            const val = outputs[node.id];
            const newVal = String(val !== undefined && val !== null ? val : '');
            if (valueControl.value !== newVal) {
              valueControl.setValue(newVal);
              area.update('node', node.id);
            }
          }
        }
      });
    },

    zoomToNode: (nodeId: string) => {
      const node = editor.getNode(nodeId);
      if (node) {
        AreaExtensions.zoomAt(area, [node]);
      }
    },
  };
}
