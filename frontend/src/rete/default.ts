import { createRoot } from 'react-dom/client';
import { ClassicPreset as Classic, type GetSchemes, NodeEditor } from 'rete';
import { type Area2D, AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import { ConnectionPathPlugin } from 'rete-connection-path-plugin';
import {
  ConnectionPlugin,
  Presets as ConnectionPresets,
} from 'rete-connection-plugin';
import {
  type ContextMenuExtra,
  ContextMenuPlugin,
} from 'rete-context-menu-plugin';
import { HistoryPlugin, Presets as HistoryPresets } from 'rete-history-plugin';
import {
  type ReactArea2D,
  ReactPlugin,
  Presets as ReactPresets,
} from 'rete-react-plugin';
import styled from 'styled-components';
import type { Sheet } from '../api';

import { CustomNode } from './CustomNode';
import { DropdownControl, DropdownControlComponent } from './DropdownControl';
import { NumberControl, NumberControlComponent } from './NumberControl';

// --- Styled Components for Context Menu ---
const { Menu, Item, Search, Common, Subitems } = ReactPresets.contextMenu;

const CustomMenu = styled(Menu)`
  font-family: system-ui, Avenir, Helvetica, Arial, sans-serif !important;
  font-size: 0.9em !important;
  background-color: var(--item-bg) !important;
  border: 1px solid var(--border-color) !important;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
  border-radius: 4px !important;
  padding: 4px !important;
  width: 150px !important;
`;

const CustomItem = styled(Item)`
  color: var(--text-color) !important;
  padding: 6px 12px !important;
  border-bottom: none !important;
  cursor: pointer !important;
  transition: background-color 0.2s !important;
  border-radius: 2px !important;
  background-color: transparent !important;

  &:hover {
    background-color: var(--item-hover) !important;
    color: var(--text-color) !important;
  }
`;

const CustomSearch = styled(Search)`
    background-color: var(--input-bg) !important;
    color: var(--text-color) !important;
    border-bottom: 1px solid var(--border-color) !important;
    font-family: inherit !important;
    border-radius: 4px 4px 0 0 !important;
`;

// --- Types ---

export const socket = new Classic.Socket('socket');

export class ParascopeNode extends Classic.Node {
  width = 180;
  height = 150;
  public dbId?: string; // ID from the database
  public type: string;
  public x = 0;
  public y = 0;
  public initialData: Record<string, any>;
  public onChange?: (value: any) => void;

  constructor(
    type: string,
    label: string,
    inputs: { key: string; socket_type: string }[],
    outputs: { key: string; socket_type: string }[],
    data: Record<string, any> = {},
    onChange?: (value: any) => void,
  ) {
    super(label);
    this.type = type;
    this.initialData = data;
    this.onChange = onChange;

    inputs.forEach((inp) => {
      this.addInput(inp.key, new Classic.Input(socket, inp.key));
    });

    outputs.forEach((out) => {
      this.addOutput(out.key, new Classic.Output(socket, out.key));
    });

    this.setupControl();
  }

  setupControl() {
    const data = this.initialData;
    const onChange = this.onChange;

    if (this.controls.value) {
      this.removeControl('value');
    }

    // Add a control to display value
    if (this.type === 'input') {
      if (data.dataType === 'option' && data.options) {
        this.addControl(
          'value',
          new DropdownControl(
            data.options,
            String(
              data.value !== undefined ? data.value : data.options[0] || '',
            ),
            (val) => {
              if (onChange) onChange(val);
            },
          ),
        );
      } else {
        const min =
          data.min !== undefined && data.min !== ''
            ? Number(data.min)
            : undefined;
        const max =
          data.max !== undefined && data.max !== ''
            ? Number(data.max)
            : undefined;

        this.addControl(
          'value',
          new NumberControl(data.value || '', {
            readonly: false,
            change: onChange,
            min,
            max,
          }),
        );
      }
    } else if (this.type === 'output') {
      if (data.dataType === 'option') {
        this.addControl(
          'value',
          new Classic.InputControl('text', {
            initial: String(data.value !== undefined ? data.value : ''),
            readonly: true,
          }),
        );
      } else {
        const min =
          data.min !== undefined && data.min !== ''
            ? Number(data.min)
            : undefined;
        const max =
          data.max !== undefined && data.max !== ''
            ? Number(data.max)
            : undefined;

        this.addControl(
          'value',
          new NumberControl(data.value || '', {
            readonly: true,
            min,
            max,
          }),
        );
      }
    } else if (this.type === 'parameter') {
      if (data.dataType === 'option' && data.options) {
        this.addControl(
          'value',
          new DropdownControl(
            data.options,
            String(
              data.value !== undefined ? data.value : data.options[0] || '',
            ),
            (val) => {
              if (onChange) onChange(val);
            },
          ),
        );
      } else {
        const min =
          data.min !== undefined && data.min !== ''
            ? Number(data.min)
            : undefined;
        const max =
          data.max !== undefined && data.max !== ''
            ? Number(data.max)
            : undefined;

        this.addControl(
          'value',
          new NumberControl(data.value !== undefined ? data.value : '', {
            readonly: false,
            change: onChange,
            min,
            max,
          }),
        );
      }
    } else if (data.value !== undefined) {
      this.addControl(
        'value',
        new Classic.InputControl('text', {
          initial: String(data.value),
          readonly: false,
          change: onChange,
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

type AreaExtra = Area2D<Schemes> | ReactArea2D<Schemes> | ContextMenuExtra;

export async function createEditor(container: HTMLElement) {
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const reactRender = new ReactPlugin<Schemes, AreaExtra>({ createRoot });
  const history = new HistoryPlugin<Schemes>();
  history.addPreset(HistoryPresets.classic.setup());

  const contextMenu = new ContextMenuPlugin<Schemes>({
    items: (context) => {
      if (context === 'root') {
        return { searchBar: false, list: [] };
      }

      // Check for connection (has source/target)
      if ('source' in context && 'target' in context) {
        return {
          searchBar: false,
          list: [
            {
              label: 'Delete',
              key: 'delete',
              handler: async () => {
                await editor.removeConnection(context.id);
              },
            },
          ],
        };
      }

      // Node
      const items = [
        {
          label: 'Edit',
          key: 'edit',
          handler: () => {
            if (onNodeEdit) onNodeEdit(context.id);
          },
        },
      ];

      if (context.type === 'sheet') {
        items.push({
          label: 'Edit Sheet',
          key: 'edit-sheet',
          handler: () => {
            if (onEditNestedSheet) onEditNestedSheet(context.id);
          },
        });
      } else if (context.type === 'input') {
        items.push({
          label: 'Switch to Parameter',
          key: 'switch-to-parameter',
          handler: () => {
            if (onNodeTypeChange) onNodeTypeChange(context.id, 'parameter');
          },
        });
      } else if (context.type === 'parameter') {
        items.push({
          label: 'Switch to Input',
          key: 'switch-to-input',
          handler: () => {
            if (onNodeTypeChange) onNodeTypeChange(context.id, 'input');
          },
        });
      }

      items.push(
        {
          label: 'Duplicate',
          key: 'duplicate',
          handler: () => {
            if (onNodeDuplicate) onNodeDuplicate(context.id);
          },
        },
        {
          label: 'Copy URL',
          key: 'copy-url',
          handler: () => {
            const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${context.id}`;
            if (navigator.clipboard?.writeText) {
              navigator.clipboard
                .writeText(url)
                .catch((err) => console.error('Failed to copy URL:', err));
            }
          },
        },
        {
          label: 'Delete',
          key: 'delete',
          handler: async () => {
            if (onNodeRemove) {
              const shouldRemove = await onNodeRemove(context.id);
              if (!shouldRemove) return;
            }
            const connections = editor.getConnections().filter((c) => {
              return c.source === context.id || c.target === context.id;
            });
            for (const c of connections) {
              await editor.removeConnection(c.id);
            }
            await editor.removeNode(context.id);
          },
        },
      );

      return {
        searchBar: false,
        list: items,
      };
    },
  });

  // We need to expose a way to set the callback later, or pass it in.
  // Since useRete calls this, we can attach it to the returned object.
  let onNodeDoubleClick: ((nodeId: string) => void) | undefined;
  let onGraphChange: (() => void) | undefined;
  let onNodeEdit: ((nodeId: string) => void) | undefined;
  let onNodeDuplicate: ((nodeId: string) => void) | undefined;
  let onNodeTypeChange: ((nodeId: string, type: string) => void) | undefined;
  let onInputValueChange: ((nodeId: string, value: string) => void) | undefined;
  let onEditNestedSheet: ((nodeId: string) => void) | undefined;
  let onNodeRemove: ((nodeId: string) => Promise<boolean>) | undefined;

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
          if (data.payload instanceof NumberControl) {
            return NumberControlComponent as any;
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
      if (onGraphChange) onGraphChange();
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
          onNodeDoubleClick(nodeId);
        }
      }
      lastNodePicked = nodeId;
      lastNodePickedTime = now;
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
    setNodeEditListener: (cb: (nodeId: string) => void) => {
      onNodeEdit = cb;
    },
    setNodeDuplicateListener: (cb: (nodeId: string) => void) => {
      onNodeDuplicate = cb;
    },
    setNodeTypeChangeListener: (cb: (nodeId: string, type: string) => void) => {
      onNodeTypeChange = cb;
    },
    setEditNestedSheetListener: (cb: (nodeId: string) => void) => {
      onEditNestedSheet = cb;
    },
    setNodeRemoveListener: (cb: (nodeId: string) => Promise<boolean>) => {
      onNodeRemove = cb;
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
            control instanceof NumberControl
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

    updateNodeValues: (
      inputs: Record<string, any>,
      outputs: Record<string, any>,
    ) => {
      editor.getNodes().forEach((node) => {
        const valueControl = node.controls
          .value as Classic.InputControl<'text'>;
        if (!valueControl) return;

        if (node.type === 'input') {
          const val = inputs[node.id];
          const newVal = String(val !== undefined && val !== null ? val : '');
          if (valueControl.value !== newVal) {
            valueControl.setValue(newVal);
            area.update('node', node.id);
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
      const node = editor.getNode(nodeId);
      if (node) {
        AreaExtensions.zoomAt(area, [node]);
      }
    },
  };
}
