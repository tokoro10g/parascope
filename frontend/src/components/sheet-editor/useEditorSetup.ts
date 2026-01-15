import { useEffect } from 'react';
import type { NodeEditorWrapper, ParascopeNode } from '../../rete';
import { createSocket } from '../../utils';

interface UseEditorSetupProps {
  editor: NodeEditorWrapper | null;
  setEditingNode: (node: ParascopeNode | null) => void;
  handleOpenNestedSheet: (nodeId: string, newTab: boolean) => void;
  handleNodeUpdate: (nodeId: string, updates: any) => Promise<void>;
  handleDuplicateNode: (nodeId: string) => Promise<void>;
  handleDelete: (nodeIds: string[]) => Promise<void>;
  handleAddNode: (type: any) => Promise<void>;
  setIsDirty: (dirty: boolean) => void;
  triggerAutoCalculation: () => void;
  handleCalculationInputChange: (id: string, value: string) => void;
}

export function useEditorSetup({
  editor,
  setEditingNode,
  handleOpenNestedSheet,
  handleNodeUpdate,
  handleDuplicateNode,
  handleDelete,
  handleAddNode,
  setIsDirty,
  triggerAutoCalculation,
  handleCalculationInputChange,
}: UseEditorSetupProps) {
  useEffect(() => {
    if (editor) {
      editor.setContextMenuCallbacks({
        onNodeEdit: (id: string) => {
          const node = editor.instance.getNode(id);
          if (node) setEditingNode(node as ParascopeNode);
        },
        onEditNestedSheet: (id: string) => {
          handleOpenNestedSheet(id, true);
        },
        onNodeTypeChange: async (nodeId: string, type: string) => {
          const node = editor.instance.getNode(nodeId) as ParascopeNode;
          if (!node) return;

          let inputs: any[] = [];
          let outputs: any[] = [];
          const data: any = { value: '' };

          const currentValue =
            (node.controls.value as any)?.value || node.data.value || '';

          if (type === 'constant') {
            outputs = [createSocket('value')];
            data.value = currentValue;
          } else if (type === 'function') {
            inputs = [createSocket('a'), createSocket('b')];
            outputs = [createSocket('result')];
            data.expression = node.data.expression || 'a + b';
          } else if (type === 'input') {
            outputs = [createSocket('value')];
          } else if (type === 'output') {
            inputs = [createSocket('value')];
          }

          await handleNodeUpdate(nodeId, {
            type,
            inputs: inputs,
            outputs: outputs,
            data: data,
          });
        },
        onNodeDuplicate: handleDuplicateNode,
        onNodeRemove: async (nodeId: string) => await handleDelete([nodeId]),
        onAddNode: (type: any) => handleAddNode(type),
      });

      editor.setNodeDoubleClickListener((id: string) => {
        const node = editor.instance.getNode(id);
        if (node) {
          if (node.type === 'sheet') {
            handleOpenNestedSheet(id, true);
          } else {
            setEditingNode(node as ParascopeNode);
          }
        }
      });

      editor.addGraphChangeListener(() => {
        setIsDirty(true);
        triggerAutoCalculation();
      });

      editor.setLayoutChangeListener(() => {
        setIsDirty(true);
      });

      editor.setInputValueChangeListener(handleCalculationInputChange);
    }
  }, [
    editor,
    setEditingNode,
    handleOpenNestedSheet,
    handleNodeUpdate,
    handleDuplicateNode,
    handleDelete,
    handleAddNode,
    setIsDirty,
    triggerAutoCalculation,
    handleCalculationInputChange,
  ]);
}
