import type { NodeEditor } from 'rete';
import { ContextMenuPlugin } from 'rete-context-menu-plugin';
import type { Schemes } from './types';
import { copyToClipboard } from '../utils';

export interface ContextMenuCallbacks {
  onNodeEdit?: (nodeId: string) => void;
  onEditNestedSheet?: (nodeId: string) => void;
  onNodeTypeChange?: (nodeId: string, type: string) => void;
  onNodeDuplicate?: (nodeId: string) => void;
  onNodeRemove?: (nodeId: string) => Promise<void>;
  onAddNode?: (
    type: 'constant' | 'function' | 'input' | 'output' | 'comment',
  ) => void;
}

export function createContextMenuPlugin(
  editor: NodeEditor<Schemes>,
  callbacks: ContextMenuCallbacks,
) {
  return new ContextMenuPlugin<Schemes>({
    items: (context) => {
      if (context === 'root') {
        return {
          searchBar: false,
          list: [
            {
              label: 'Add Constant',
              key: 'add-constant',
              handler: () => callbacks.onAddNode?.('constant'),
            },
            {
              label: 'Add Function',
              key: 'add-function',
              handler: () => callbacks.onAddNode?.('function'),
            },
            {
              label: 'Add Input',
              key: 'add-input',
              handler: () => callbacks.onAddNode?.('input'),
            },
            {
              label: 'Add Output',
              key: 'add-output',
              handler: () => callbacks.onAddNode?.('output'),
            },
            {
              label: 'Add Comment',
              key: 'add-comment',
              handler: () => callbacks.onAddNode?.('comment'),
            },
          ],
        };
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
      const items = [];

      if (context.type === 'sheet') {
        items.push({
          label: 'Open in New Tab',
          key: 'edit-sheet',
          handler: () => {
            if (callbacks.onEditNestedSheet)
              callbacks.onEditNestedSheet(context.id);
          },
        });
      }

      items.push({
        label: 'Edit',
        key: 'edit',
        handler: () => {
          if (callbacks.onNodeEdit) callbacks.onNodeEdit(context.id);
        },
      });

      if (context.type === 'input') {
        items.push({
          label: 'Switch to Constant',
          key: 'switch-to-constant',
          handler: () => {
            if (callbacks.onNodeTypeChange)
              callbacks.onNodeTypeChange(context.id, 'constant');
          },
        });
      } else if (context.type === 'constant') {
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
            copyToClipboard(url);
          },
        },
        {
          label: 'Delete',
          key: 'delete',
          handler: async () => {
            if (callbacks.onNodeRemove) {
              await callbacks.onNodeRemove(context.id);
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
}
