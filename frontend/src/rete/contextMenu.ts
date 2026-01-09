import type { NodeEditor } from 'rete';
import { ContextMenuPlugin } from 'rete-context-menu-plugin';
import type { Schemes } from './types';

export interface ContextMenuCallbacks {
  onNodeEdit?: (nodeId: string) => void;
  onEditNestedSheet?: (nodeId: string) => void;
  onNodeTypeChange?: (nodeId: string, type: string) => void;
  onNodeDuplicate?: (nodeId: string) => void;
  onNodeRemove?: (nodeId: string) => Promise<boolean>;
}

export function createContextMenuPlugin(
  editor: NodeEditor<Schemes>,
  callbacks: ContextMenuCallbacks,
) {
  return new ContextMenuPlugin<Schemes>({
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
            if (callbacks.onNodeEdit) callbacks.onNodeEdit(context.id);
          },
        },
      ];

      if (context.type === 'sheet') {
        items.push({
          label: 'Open in New Tab',
          key: 'edit-sheet',
          handler: () => {
            if (callbacks.onEditNestedSheet)
              callbacks.onEditNestedSheet(context.id);
          },
        });
      } else if (context.type === 'input') {
        items.push({
          label: 'Switch to Parameter',
          key: 'switch-to-parameter',
          handler: () => {
            if (callbacks.onNodeTypeChange)
              callbacks.onNodeTypeChange(context.id, 'parameter');
          },
        });
      } else if (context.type === 'parameter') {
        items.push({
          label: 'Switch to Input',
          key: 'switch-to-input',
          handler: () => {
            if (callbacks.onNodeTypeChange)
              callbacks.onNodeTypeChange(context.id, 'input');
          },
        });
      }

      items.push(
        {
          label: 'Duplicate',
          key: 'duplicate',
          handler: () => {
            if (callbacks.onNodeDuplicate)
              callbacks.onNodeDuplicate(context.id);
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
            if (callbacks.onNodeRemove) {
              const shouldRemove = await callbacks.onNodeRemove(context.id);
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
}
