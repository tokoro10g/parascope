import { createRoot } from 'react-dom/client';
import { type ClassicPreset as Classic, NodeEditor } from 'rete';
import { type Area2D, AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import { ConnectionPathPlugin } from 'rete-connection-path-plugin';
import {
  ConnectionPlugin,
  Presets as ConnectionPresets,
} from 'rete-connection-plugin';
import { HistoryPlugin, Presets as HistoryPresets } from 'rete-history-plugin';
import { ReactPlugin, Presets as ReactPresets } from 'rete-react-plugin';

import { CustomItem, CustomMenu, CustomSearch } from './components/ContextMenuStyles';
import { CustomNode } from './components/CustomNode';
import { CustomSocket } from './components/CustomSocket';
import {
  type ContextMenuCallbacks,
  createContextMenuPlugin,
} from './contextMenu';
import { DropdownControl, DropdownControlComponent } from './components/DropdownControl';
import { createFactory } from './factory';
import { InputControl, InputControlComponent } from './components/InputControl';
import { createLoader } from './loader';
import { MarkdownControl, MarkdownControlComponent } from './components/MarkdownControl';
import { createOperations } from './operations';
import type { ParascopeNode } from './ParascopeNode';
import { customSelectableNodes } from './selectable';
import type { AreaExtra, Connection, Schemes } from './types';
import { createViewport } from './viewport';
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

  let onNodeDoubleClick: ((nodeId: string) => void) | undefined;
  const graphChangeListeners = new Set<() => void>();
  let onLayoutChange: (() => void) | undefined;
  let onViewportChange: (() => void) | undefined;
  let onInputValueChange: ((nodeId: string, value: string) => void) | undefined;
  let onConnectionCreated:
    | ((connection: Connection<ParascopeNode, ParascopeNode>) => void)
    | undefined;

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

  // Compose Modules
  const viewport = createViewport(instance, area, selectableNodes, selector);
  const operations = createOperations(
    instance,
    area,
    history,
    notifyGraphChange,
  );
  const factory = createFactory(
    instance,
    area,
    viewport.calcCenterPosition,
    notifyGraphChange,
  );
  const loader = createLoader(
    instance,
    area,
    history,
    viewport.zoomToNode,
    viewport.zoomToFit,
    viewport.selectNode,
    (suppress) => {
      suppressGraphChange = suppress;
    },
  );

  const createOnCommit = (node: ParascopeNode) => {
    return (oldVal: any, newVal: any) => {
      const normalizedOld = oldVal ?? '';
      const normalizedNew = newVal ?? '';
      if (normalizedOld === normalizedNew) return;

      if (node.type === 'input') {
        if (onInputValueChange && node.id)
          onInputValueChange(node.id, String(normalizedNew));
      }

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

  const pathPlugin = new ConnectionPathPlugin<Schemes, Area2D<Schemes>>({
    arrow: () => true,
  });
  reactRender.use(pathPlugin);

  connection.addPreset(ConnectionPresets.classic.setup());
  reactRender.addPreset(
    ReactPresets.classic.setup({
      customize: {
        node: () => CustomNode,
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
        const isEditableTitle =
          lastPointerDownTarget instanceof Element &&
          (lastPointerDownTarget.classList.contains('node-title-editable') ||
            lastPointerDownTarget.closest('.node-title-editable') ||
            lastPointerDownTarget.classList.contains('node-title-input'));

        if (onNodeDoubleClick && !isEditableTitle) {
          const callback = onNodeDoubleClick;
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
    triggerGraphChange: notifyGraphChange,
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

    // Viewport Math
    ...viewport,

    // Node Factory
    ...factory,

    // Graph Surgery
    ...operations,

    // Database Loader
    ...loader,

    updateNodeValues: (
      fullResult?: Record<string, any>,
      inputOverrides: Record<string, any> = {},
    ) => {
      instance.getNodes().forEach((node) => {
        if (fullResult?.[node.id]) {
          const nodeRes = fullResult[node.id];
          if (nodeRes.outputs) {
            (node as ParascopeNode).calculatedValues = { ...nodeRes.outputs };
            Object.entries(nodeRes.outputs).forEach(([key, val]) => {
              const output = node.outputs[key];
              if (output?.socket) {
                (output.socket as any).value = val;
              }
            });
          }

          if (nodeRes.inputs) {
            Object.entries(nodeRes.inputs).forEach(([key, val]) => {
              const input = node.inputs[key];
              if (input?.socket) {
                (input.socket as any).value = val;
              }
            });
          }
          area.update('node', node.id);
        } else {
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
          if (Object.hasOwn(inputOverrides, node.id)) {
            const val = inputOverrides[node.id];
            const newVal = String(val !== undefined && val !== null ? val : '');
            if (valueControl.value !== newVal) {
              valueControl.setValue(newVal);
              area.update('node', node.id);
            }
          }
        } else if (node.type === 'output') {
          const val = fullResult?.[node.id]?.outputs?.value;
          const newVal = String(val !== undefined && val !== null ? val : '');
          if (valueControl.value !== newVal) {
            valueControl.setValue(newVal);
            area.update('node', node.id);
          }
        }
      });
    },

    getSelectedNodes: () => {
      return instance
        .getNodes()
        .filter((n) => selector.isSelected({ id: n.id, label: 'node' }));
    },
    clearSelection: () => {
      selector.unselectAll();
    },
  };
}
