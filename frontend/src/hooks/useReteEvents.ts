import { useEffect } from 'react';
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
    handleEvaluatorInputChange: (id: string, value: string) => void;
  },
  refs: {
    lastResultRef: React.MutableRefObject<any>;
    evaluatorInputsRef: React.MutableRefObject<any>;
  },
) {
  const {
    setEditingNode,
    handleDuplicateNode,
    handleNodeUpdate,
    setIsDirty,
    setNodes,
    triggerAutoCalculation,
    handleEvaluatorInputChange,
  } = callbacks;

  const { lastResultRef, evaluatorInputsRef } = refs;

  useEffect(() => {
    if (editor) {
      const handleEdit = (nodeId: string) => {
        const node = editor.editor.getNode(nodeId);
        if (node) {
          setEditingNode(node);
        }
      };
      editor.setNodeDoubleClickListener(handleEdit);
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
        onEditNestedSheet: (nodeId: string) => {
          const node = editor.editor.getNode(nodeId);
          if (node?.initialData?.sheetId) {
            const queryString = resolveNestedSheetParams(
              editor.editor,
              nodeId,
              lastResultRef.current,
              evaluatorInputsRef.current,
            );
            const url = `/sheet/${node.initialData.sheetId}${
              queryString ? `?${queryString}` : ''
            }`;
            window.open(url, '_blank');
          }
        },
      });
      editor.setGraphChangeListener(() => {
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
        triggerAutoCalculation();
      });
      editor.setInputValueChangeListener((nodeId: string, value: string) => {
        handleEvaluatorInputChange(nodeId, value);
      });
      // This second call seems redundant in original code, but keeping for safety if it attaches specifics
      editor.setContextMenuCallbacks({
        onNodeDuplicate: handleDuplicateNode,
      });
    }
  }, [
    editor,
    handleEvaluatorInputChange,
    handleNodeUpdate,
    handleDuplicateNode,
    triggerAutoCalculation,
    setEditingNode,
    setIsDirty,
    setNodes,
    lastResultRef,
    evaluatorInputsRef,
  ]);
}
