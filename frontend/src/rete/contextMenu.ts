import type { NodeEditor } from 'rete';
import type { AreaPlugin } from 'rete-area-plugin';
import type { ConnectionPlugin } from 'rete-connection-plugin';
import { ContextMenuPlugin } from 'rete-context-menu-plugin';
import { copyToClipboard } from '../utils';
import type { AreaExtra, Schemes } from './types';

export interface ContextMenuCallbacks {
  onNodeEdit?: (nodeId: string) => void;
  onEditNestedSheet?: (nodeId: string) => void;
  onNodeTypeChange?: (nodeId: string, type: string) => void;
  onNodeDuplicate?: (nodeId: string) => void;
  onNodeRemove?: (nodeId: string) => Promise<void>;
  onAddNode?: (
    type:
      | 'constant'
      | 'function'
      | 'input'
      | 'output'
      | 'comment'
      | 'lut'
      | 'sheet',
    position: { x: number; y: number },
    connectionInfo?: {
      source?: { nodeId: string; portKey: string };
      target?: { nodeId: string; portKey: string };
    },
  ) => void;
}

export type PendingConnection = {
  source?: { nodeId: string; portKey: string };
  target?: { nodeId: string; portKey: string };
};

export function createContextMenuPlugin(
  editor: NodeEditor<Schemes>,
  area: AreaPlugin<Schemes, AreaExtra>,
  connection: ConnectionPlugin<Schemes, AreaExtra>,
  callbacks: ContextMenuCallbacks,
  getSelectedNodes: () => Schemes['Node'][],
) {
  const plugin = new ContextMenuPlugin<Schemes>({
    items: (context) => {
      const isPending = (context as any)?.type === 'pending-connection';

      if (context === 'root' || isPending) {
        const pending = isPending
          ? ((context as any).data as PendingConnection)
          : undefined;

        const list = [];

        // Helper to add node with pending connection info
        const add = (type: any) => {
          const pointer = area.area.pointer;
          callbacks.onAddNode?.(type, pointer, pending);
        };

        if (!pending || pending.source) {
          // If dragging FROM an output, we want to add an Output node
          list.push({
            label: 'Add Output',
            key: 'add-output',
            handler: () => add('output'),
          });
        }

        if (!pending || pending.target) {
          // If dragging TO an input, we want to add an Input or Constant node
          list.push(
            {
              label: 'Add Constant',
              key: 'add-constant',
              handler: () => add('constant'),
            },
            {
              label: 'Add Input',
              key: 'add-input',
              handler: () => add('input'),
            },
          );
        }

        if (!pending) {
          list.push({
            label: 'Add Function',
            key: 'add-function',
            handler: () => add('function'),
          });

          list.push(
            {
              label: 'Add Lookup Table',
              key: 'add-lut',
              handler: () => add('lut'),
            },
            {
              label: 'Import Sheet',
              key: 'import-sheet',
              handler: () => add('sheet'),
            },
          );

          list.push({
            label: 'Add Comment',
            key: 'add-comment',
            handler: () => add('comment'),
          });
        }

        return {
          searchBar: false,
          list,
        };
      }

      const anyContext = context as any;

      // Check for connection (has source/target)
      if (anyContext && 'source' in anyContext && 'target' in anyContext) {
        return {
          searchBar: false,
          list: [
            {
              label: 'Delete',
              key: 'delete',
              handler: async () => {
                await editor.removeConnection(anyContext.id);
              },
            },
          ],
        };
      }

      // Node
      const selectedNodes = getSelectedNodes();
      const isSelected = selectedNodes.some((n) => n.id === anyContext.id);

      if (selectedNodes.length > 1 && isSelected) {
        return {
          searchBar: false,
          list: [
            // Multi-node actions will go here
          ],
        };
      }

      const items = [];

      if (anyContext.type === 'sheet') {
        items.push({
          label: 'Open in New Tab',
          key: 'edit-sheet',
          handler: () => {
            if (callbacks.onEditNestedSheet)
              callbacks.onEditNestedSheet(anyContext.id);
          },
        });
      }

      items.push({
        label: 'Edit',
        key: 'edit',
        handler: () => {
          if (callbacks.onNodeEdit) callbacks.onNodeEdit(anyContext.id);
        },
      });

      if (anyContext.type === 'input') {
        items.push({
          label: 'Switch to Constant',
          key: 'switch-to-constant',
          handler: () => {
            if (callbacks.onNodeTypeChange)
              callbacks.onNodeTypeChange(anyContext.id, 'constant');
          },
        });
      } else if (anyContext.type === 'constant') {
        items.push({
          label: 'Switch to Input',
          key: 'switch-to-input',
          handler: () => {
            if (callbacks.onNodeTypeChange)
              callbacks.onNodeTypeChange(anyContext.id, 'input');
          },
        });
      }

      items.push(
        {
          label: 'Duplicate',
          key: 'duplicate',
          handler: () => {
            if (callbacks.onNodeDuplicate)
              callbacks.onNodeDuplicate(anyContext.id);
          },
        },
        {
          label: 'Copy URL',
          key: 'copy-url',
          handler: () => {
            const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${anyContext.id}`;
            copyToClipboard(url);
          },
        },
        {
          label: 'Delete',
          key: 'delete',
          handler: async () => {
            if (callbacks.onNodeRemove) {
              await callbacks.onNodeRemove(anyContext.id);
            }
          },
        },
      );

      return {
        searchBar: false,
        list: items,
      };
    },
  });

  connection.addPipe((context) => {
    if (context.type === 'connectiondrop') {
      const { initial, socket, created } = context.data;
      if (!created && !socket) {
        const pointer = area.area.pointer;
        const { x, y, k } = area.area.transform;
        const rect = area.container.getBoundingClientRect();
        const screenX = pointer.x * k + x + rect.left;
        const screenY = pointer.y * k + y + rect.top;

        const pending: PendingConnection =
          initial.side === 'output'
            ? { source: { nodeId: initial.nodeId, portKey: initial.key } }
            : { target: { nodeId: initial.nodeId, portKey: initial.key } };

        // Small delay to ensure pointer events are processed
        setTimeout(() => {
          area.emit({
            type: 'contextmenu',
            data: {
              event: new MouseEvent('contextmenu', {
                clientX: screenX,
                clientY: screenY,
              }),
              context: { type: 'pending-connection', data: pending } as any,
            },
          });
        }, 50);
      }
    }
    return context;
  });

  return plugin;
}
