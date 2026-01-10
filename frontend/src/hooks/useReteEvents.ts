import { useEffect, useRef } from 'react';
import type { NodeEditorWrapper, ParascopeNode } from '../rete';
import { resolveNestedSheetParams } from '../utils';

export function useReteEvents(
  editor: NodeEditorWrapper | undefined,
  callbacks: {
    setEditingNode: (node: ParascopeNode | null) => void;
    handleDuplicateNode: (id: string) => void;
    handleNodeUpdate: (id: string, updates: any) => void;
    setIsDirty: (isDirty: boolean) => void;
    setNodes: (nodes: ParascopeNode[]) => void;
    triggerAutoCalculation: () => void;
    handleCalculationInputChange: (id: string, value: string) => void;
    onPaste: (data: any) => void;
    onDelete: (nodeIds: string[]) => void;
    onViewportChange?: () => void;
  },
  refs: {
    lastResultRef: React.MutableRefObject<any>;
    calculationInputsRef: React.MutableRefObject<any>;
  },
) {
  const {
    setEditingNode,
    handleDuplicateNode,
    handleNodeUpdate,
    setIsDirty,
    setNodes,
    triggerAutoCalculation,
    handleCalculationInputChange,
    onPaste,
    onDelete,
    onViewportChange,
  } = callbacks;

  const { lastResultRef, calculationInputsRef } = refs;
  const clipboardRef = useRef<any[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editor?.getSelectedNodes) {
          const selected = editor.getSelectedNodes();
          if (selected.length > 0) {
            onDelete(selected.map((n) => n.id));
          }
        }
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          if (editor?.getSelectedNodes) {
            const selected = editor.getSelectedNodes();
            if (selected.length > 0) {
              clipboardRef.current = selected.map((n) => {
                const view = editor.area.nodeViews.get(n.id);
                return {
                  type: n.type,
                  label: n.label,
                  inputs: Object.keys(n.inputs),
                  outputs: Object.keys(n.outputs),
                  initialData: JSON.parse(JSON.stringify(n.initialData)),
                  controls: n.controls.value
                    ? { value: (n.controls.value as any).value }
                    : {},
                  position: view
                    ? { x: view.position.x, y: view.position.y }
                    : { x: 0, y: 0 },
                };
              });
            }
          }
        }
        if (e.key === 'v') {
          if (clipboardRef.current.length > 0) {
            onPaste(clipboardRef.current);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, onPaste, onDelete]);

  useEffect(() => {
    if (editor) {
      const handleEdit = (nodeId: string) => {
        const node = editor.editor.getNode(nodeId);
        if (node) {
          setEditingNode(node);
        }
      };

      const handleEditNestedSheet = (nodeId: string) => {
        const node = editor.editor.getNode(nodeId);
        if (node?.initialData?.sheetId) {
          const queryString = resolveNestedSheetParams(
            editor.editor,
            nodeId,
            lastResultRef.current,
            calculationInputsRef.current,
          );
          const url = `/sheet/${node.initialData.sheetId}${
            queryString ? `?${queryString}` : ''
          }`;
          window.open(url, '_blank');
        }
      };

      const handleDoubleClick = (nodeId: string) => {
        const node = editor.editor.getNode(nodeId);
        if (node?.type === 'sheet') {
          handleEditNestedSheet(nodeId);
        } else {
          handleEdit(nodeId);
        }
      };

      editor.setNodeDoubleClickListener(handleDoubleClick);
      editor.setContextMenuCallbacks({
        onNodeEdit: handleEdit,
        onNodeDuplicate: handleDuplicateNode,
        onNodeTypeChange: (nodeId: string, type: string) => {
          handleNodeUpdate(nodeId, { type });
        },
        onNodeRemove: async (nodeId: string) => {
          const node = editor.editor.getNode(nodeId);
          if (node && (node.type === 'input' || node.type === 'output')) {
            return window.confirm(
              `Deleting this ${node.type} node may break sheets that use this sheet as a function. Are you sure?`,
            );
          }
          return true;
        },
        onEditNestedSheet: handleEditNestedSheet,
      });
      const updateNodesState = () => {
        setIsDirty(true);
        const nodes = [...editor.editor.getNodes()];
        nodes.forEach((n) => {
          const pos = editor.area.nodeViews.get(n.id)?.position;
          if (pos) {
            n.x = pos.x;
            n.y = pos.y;
          }
        });
        setNodes(nodes);
      };

      editor.setGraphChangeListener(() => {
        updateNodesState();
        triggerAutoCalculation();
      });
      editor.setLayoutChangeListener(() => {
        updateNodesState();
      });
      if (onViewportChange) {
        editor.setViewportChangeListener(onViewportChange);
      }
      editor.setInputValueChangeListener((nodeId: string, value: string) => {
        handleCalculationInputChange(nodeId, value);
      });
      // This second call seems redundant in original code, but keeping for safety if it attaches specifics
      editor.setContextMenuCallbacks({
        onNodeDuplicate: handleDuplicateNode,
      });
    }
  }, [
    editor,
    handleCalculationInputChange,
    handleNodeUpdate,
    handleDuplicateNode,
    triggerAutoCalculation,
    setEditingNode,
    setIsDirty,
    setNodes,
    lastResultRef,
    calculationInputsRef,
    onPaste,
    onDelete,
    onViewportChange,
  ]);
}
