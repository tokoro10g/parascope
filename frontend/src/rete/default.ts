import { createRoot } from 'react-dom/client';
import { ClassicPreset as Classic, NodeEditor } from 'rete';
import { type Area2D, AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import { ConnectionPathPlugin } from 'rete-connection-path-plugin';
import {
  ConnectionPlugin,
  Presets as ConnectionPresets,
} from 'rete-connection-plugin';
import { HistoryPlugin, Presets as HistoryPresets } from 'rete-history-plugin';
import { ReactPlugin, Presets as ReactPresets } from 'rete-react-plugin';
import type { Sheet } from '../api';
import { createSocket } from '../utils';

import { CustomItem, CustomMenu, CustomSearch } from './ContextMenuStyles';
import { CustomNode } from './CustomNode';
import { CustomSocket } from './CustomSocket';
import {
  type ContextMenuCallbacks,
  createContextMenuPlugin,
} from './contextMenu';
import { DropdownControl, DropdownControlComponent } from './DropdownControl';
import { InputControl, InputControlComponent } from './InputControl';
import { MarkdownControl, MarkdownControlComponent } from './MarkdownControl';
import { ParascopeNode } from './ParascopeNode';
import { customSelectableNodes } from './selectable';
import {
  type AreaExtra,
  Connection,
  type NodeType,
  type Schemes,
} from './types';
import { ZoomHandler } from './ZoomHandler';

// --- Types ---

const { Common, Subitems } = ReactPresets.contextMenu;

export type NodeEditorWrapper = Awaited<ReturnType<typeof createEditor>>;

export async function createEditor(container: HTMLElement) {
  const instance = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const reactRender = new ReactPlugin<Schemes, AreaExtra>({ createRoot });
  const history = new HistoryPlugin<Schemes>();
  history.addPreset(HistoryPresets.classic.setup());

  const contextMenuCallbacks: ContextMenuCallbacks = {};
  const selector = AreaExtensions.selector();
  const contextMenu = createContextMenuPlugin(
    instance,
    area,
    connection,
    contextMenuCallbacks,
    () =>
      instance
        .getNodes()
        .filter((n) => selector.isSelected({ id: n.id, label: 'node' })),
  );

  // We need to expose a way to set the callback later, or pass it in.
  // Since useRete calls this, we can attach it to the returned object.
  let onNodeDoubleClick: ((nodeId: string) => void) | undefined;
  const graphChangeListeners = new Set<() => void>();
  let onLayoutChange: (() => void) | undefined;
  let onViewportChange: (() => void) | undefined;
  let onInputValueChange: ((nodeId: string, value: string) => void) | undefined;
  let onConnectionCreated:
    | ((connection: Connection<ParascopeNode, ParascopeNode>) => void)
    | undefined;

  // Flag to suppress graph change events (e.g. during loading)
  let suppressGraphChange = false;

  const notifyGraphChange = () => {
    if (!suppressGraphChange) {
      graphChangeListeners.forEach((cb) => {
        cb();
      });
    }
  };

  const selectableNodes = customSelectableNodes(instance, area, selector, {
    accumulating: {
      active: (e) => e.ctrlKey || e.metaKey || e.shiftKey,
    },
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
        socket: () => CustomSocket,
        control: (data) => {
          if (data.payload instanceof DropdownControl) {
            return DropdownControlComponent as any;
          }
          if (data.payload instanceof InputControl) {
            return InputControlComponent as any;
          }
          if (data.payload instanceof MarkdownControl) {
            return MarkdownControlComponent as any;
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

  const createOnCommit = (node: ParascopeNode) => {
    return (oldVal: any, newVal: any) => {
      const normalizedOld = oldVal ?? '';
      const normalizedNew = newVal ?? '';
      if (normalizedOld === normalizedNew) return;

      // Trigger calculation and state updates only when value is committed (blur/Enter)
      if (node.type === 'input') {
        if (onInputValueChange && node.id)
          onInputValueChange(node.id, String(normalizedNew));
      }

      // ALWAYS notify graph change to trigger dirty flag
      notifyGraphChange();

      if (node.id) {
        history.add({
          redo: () => {
            const n = instance.getNode(node.id) as ParascopeNode;
            const control = n?.controls.value as InputControl;
            if (control) {
              control.setValue(normalizedNew);
              if (n?.type === 'input') {
                if (onInputValueChange)
                  onInputValueChange(node.id, String(normalizedNew));
              }
              notifyGraphChange();
            }
          },
          undo: () => {
            const n = instance.getNode(node.id) as ParascopeNode;
            const control = n?.controls.value as InputControl;
            if (control) {
              control.setValue(normalizedOld);
              if (n?.type === 'input') {
                if (onInputValueChange)
                  onInputValueChange(node.id, String(normalizedOld));
              }
              notifyGraphChange();
            }
          },
        });
      }
    };
  };

  const setupNodeListeners = (node: ParascopeNode) => {
    node.notifyGraphChange = notifyGraphChange;
    node.onInputValueChange = (val: string) => {
      if (onInputValueChange && node.id) onInputValueChange(node.id, val);
    };
    node.onCommit = createOnCommit(node);
    node.setupControl();
  };

  // Listen for changes
  instance.addPipe((context) => {
    if (context.type === 'nodecreated') {
      setupNodeListeners(context.data as ParascopeNode);
      notifyGraphChange();
    } else if (context.type === 'connectioncreated') {
      if (onConnectionCreated && !suppressGraphChange)
        onConnectionCreated(
          context.data as Connection<ParascopeNode, ParascopeNode>,
        );
      notifyGraphChange();
    } else if (
      context.type === 'connectionremoved' ||
      context.type === 'noderemoved'
    ) {
      notifyGraphChange();
    }
    return context;
  });

  area.addPipe((context) => {
    if (context.type === 'translate' && selectableNodes.isMarqueeActive()) {
      return;
    }
    if (context.type === 'nodetranslated') {
      const { previous, position } = context.data;
      if (previous.x !== position.x || previous.y !== position.y) {
        if (onLayoutChange) {
          onLayoutChange();
        } else {
          notifyGraphChange();
        }
      }
    }
    if (context.type === 'translated' || context.type === 'zoomed') {
      if (onViewportChange) onViewportChange();
    }
    return context;
  });

  instance.use(area);
  area.area.setZoomHandler(new ZoomHandler(0.2));
  area.use(connection);
  area.use(reactRender);
  area.use(history);
  area.use(contextMenu);

  AreaExtensions.zoomAt(area, instance.getNodes());
  AreaExtensions.snapGrid(area, { size: 20 });

  let lastNodePicked: string | null = null;
  let lastNodePickedTime = 0;
  let lastPointerDownTarget: EventTarget | null = null;

  area.addPipe((context) => {
    if (context.type === 'pointerdown') {
      lastPointerDownTarget = (context.data as any).event.target;
    }
    if (context.type === 'nodepicked') {
      const nodeId = context.data.id;
      const now = Date.now();
      if (lastNodePicked === nodeId && now - lastNodePickedTime < 300) {
        // Check if we clicked on an editable title
        const isEditableTitle =
          lastPointerDownTarget instanceof Element &&
          (lastPointerDownTarget.classList.contains('node-title-editable') ||
            lastPointerDownTarget.closest('.node-title-editable') ||
            lastPointerDownTarget.classList.contains('node-title-input'));

        if (onNodeDoubleClick && !isEditableTitle) {
          const callback = onNodeDoubleClick;
          // Wait for mouse release to avoid sticky drag state
          window.addEventListener(
            'pointerup',
            () => {
              callback(nodeId);
            },
            { once: true },
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
    instance,
    area,
    destroy: () => area.destroy(),
    setNodeDoubleClickListener: (cb: (nodeId: string) => void) => {
      onNodeDoubleClick = cb;
    },
    setContextMenuCallbacks: (callbacks: ContextMenuCallbacks) => {
      Object.assign(contextMenuCallbacks, callbacks);
    },
    addGraphChangeListener: (cb: () => void) => {
      graphChangeListeners.add(cb);
      return () => {
        graphChangeListeners.delete(cb);
      };
    },
    triggerGraphChange: () => {
      notifyGraphChange();
    },
    setLayoutChangeListener: (cb: () => void) => {
      onLayoutChange = cb;
    },
    setViewportChangeListener: (cb: () => void) => {
      onViewportChange = cb;
    },
    setInputValueChangeListener: (
      cb: (nodeId: string, value: string) => void,
    ) => {
      onInputValueChange = cb;
    },
    setConnectionCreatedListener: (
      cb: (connection: Connection<ParascopeNode, ParascopeNode>) => void,
    ) => {
      onConnectionCreated = cb;
    },
    addConnection: async (
      connection: Connection<ParascopeNode, ParascopeNode>,
    ) => {
      await instance.addConnection(connection);
    },
    undo: async () => {
      await history.undo();
      notifyGraphChange();
    },
    redo: async () => {
      await history.redo();
      notifyGraphChange();
    },
    addHistoryAction: (action: {
      redo: () => Promise<void> | void;
      undo: () => Promise<void> | void;
    }) => {
      history.add(action);
    },

    // Helper to load a sheet from the API
    loadSheet: async (sheet: Sheet, focusNodeId?: string) => {
      suppressGraphChange = true;
      try {
        await instance.clear();

        const nodeMap = new Map<string, ParascopeNode>();

        // Create Nodes
        for (const n of sheet.nodes) {
          if (!n.id) continue;
          // Parse inputs/outputs if they are JSON strings, or use them directly if objects
          const inputs = Array.isArray(n.inputs) ? n.inputs : [];
          const outputs = Array.isArray(n.outputs) ? n.outputs : [];

          const node = new ParascopeNode(
            n.type as NodeType,
            n.label || n.type,
            inputs,
            outputs,
            n.data || {},
          );

          node.id = n.id; // Use the DB ID as the Rete ID
          node.dbId = n.id;

          await instance.addNode(node);

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
              await instance.addConnection(conn);
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
            for (const node of instance.getNodes()) {
              await area.update('node', node.id);
            }

            if (focusNodeId) {
              const node = instance.getNode(focusNodeId);
              if (node) {
                await AreaExtensions.zoomAt(area, [node]);
                selectableNodes.select(node.id, false);
              } else {
                await AreaExtensions.zoomAt(area, instance.getNodes());
              }
            } else {
              await AreaExtensions.zoomAt(area, instance.getNodes());
            }
            resolve();
          }, 200);
        });
      } finally {
        suppressGraphChange = false;
      }
    },

    // Helper to get current graph state
    getGraphData: () => {
      const isUuid = (id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        );

      const allNodes = instance.getNodes();

      const nodes = allNodes.map((n) => {
        const data: Record<string, any> = {};

        // Capture control values
        for (const [key, control] of Object.entries(n.controls)) {
          if (
            control instanceof Classic.InputControl ||
            control instanceof DropdownControl ||
            control instanceof InputControl
          ) {
            data[key] = control.value ?? '';
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
    },

    updateNodeValues: (
      inputs: Record<string, any>,
      outputs: Record<string, any>,
      fullResult?: Record<string, any>,
    ) => {
      instance.getNodes().forEach((node) => {
        // Update calculated values for displaying at sockets
        if (fullResult?.[node.id]) {
          const nodeRes = fullResult[node.id];
          if (nodeRes.outputs) {
            (node as ParascopeNode).calculatedValues = { ...nodeRes.outputs };

            // Update output sockets
            Object.entries(nodeRes.outputs).forEach(([key, val]) => {
              const output = node.outputs[key];
              if (output?.socket) {
                (output.socket as any).value = val;
              }
            });
          }

          if (nodeRes.inputs) {
            // Update input sockets
            Object.entries(nodeRes.inputs).forEach(([key, val]) => {
              const input = node.inputs[key];
              if (input?.socket) {
                (input.socket as any).value = val;
              }
            });
          }
          area.update('node', node.id);
        } else {
          // Clear calculated values if no result for this node
          (node as ParascopeNode).calculatedValues = {};
          for (const key in node.inputs) {
            const input = node.inputs[key];
            if (input?.socket) (input.socket as any).value = undefined;
          }
          for (const key in node.outputs) {
            const output = node.outputs[key];
            if (output?.socket) (output.socket as any).value = undefined;
          }
          area.update('node', node.id);
        }

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
          const val = outputs[node.id];
          const newVal = String(val !== undefined && val !== null ? val : '');
          if (valueControl.value !== newVal) {
            valueControl.setValue(newVal);
            area.update('node', node.id);
          }
        }
      });
    },

    zoomToNode: (nodeId: string) => {
      const node = instance.getNode(nodeId);
      if (node) {
        AreaExtensions.zoomAt(area, [node]);
      }
    },
    zoomToFit: async () => {
      await AreaExtensions.zoomAt(area, instance.getNodes());
    },
    getSelectedNodes: () => {
      return instance
        .getNodes()
        .filter((n) => selector.isSelected({ id: n.id, label: 'node' }));
    },
    selectNode: (nodeId: string, accumulate: boolean) => {
      selectableNodes.select(nodeId, accumulate);
    },
    clearSelection: () => {
      selector.unselectAll();
    },
  };
}
