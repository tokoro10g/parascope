import { useEffect, useRef } from 'react';
import { api } from '../api';
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
        e.preventDefault();
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
          onDelete([nodeId]);
        },
        onEditNestedSheet: handleEditNestedSheet,
      });

      editor.setConnectionCreatedListener(async (connection) => {
        const source = editor.editor.getNode(connection.source);
        const target = editor.editor.getNode(connection.target);

        let sheetNode: ParascopeNode | null = null;
        let otherNode: ParascopeNode | null = null;
        let isInputToSheet = false;

        if (
          target?.type === 'sheet' &&
          (source?.type === 'constant' || source?.type === 'input')
        ) {
          sheetNode = target;
          otherNode = source;
          isInputToSheet = true;
        } else if (source?.type === 'sheet' && target?.type === 'output') {
          sheetNode = source;
          otherNode = target;
          isInputToSheet = false;
        }

        if (sheetNode && otherNode) {
          const nestedSheetId = sheetNode.initialData?.sheetId;
          const portKey = isInputToSheet
            ? connection.targetInput
            : connection.sourceOutput;

          if (nestedSheetId && portKey) {
            try {
              const nestedSheet = await api.getSheet(nestedSheetId);

              // 1. Sync Target Node (Sheet Node) Ports if stale
              const expectedInputs = nestedSheet.nodes
                .filter((n: any) => n.type === 'input')
                .map((n: any) => ({ key: n.label, socket_type: 'any' }));

              const expectedOutputs = nestedSheet.nodes
                .filter(
                  (n: any) => n.type === 'output' || n.type === 'constant',
                )
                .map((n: any) => ({ key: n.label, socket_type: 'any' }));

              const currentInputsKeys = Object.keys(sheetNode.inputs);
              const currentOutputsKeys = Object.keys(sheetNode.outputs);

              const inputsChanged =
                expectedInputs.length !== currentInputsKeys.length ||
                !expectedInputs.every((i: any) => sheetNode!.inputs[i.key]);

              const outputsChanged =
                expectedOutputs.length !== currentOutputsKeys.length ||
                !expectedOutputs.every((o: any) => sheetNode!.outputs[o.key]);

              if (inputsChanged || outputsChanged) {
                await handleNodeUpdate(sheetNode.id, {
                  inputs: expectedInputs,
                  outputs: expectedOutputs,
                });
              }

              // 2. Configure Connected Node
              const matchingChildNode = nestedSheet.nodes.find(
                (n: any) =>
                  n.label === portKey &&
                  (isInputToSheet
                    ? n.type === 'input'
                    : n.type === 'output' || n.type === 'constant'),
              );

              if (matchingChildNode) {
                const isOption = matchingChildNode.data?.dataType === 'option';
                let updates: any = null;

                if (isOption) {
                  if (
                    otherNode.initialData.dataType !== 'option' ||
                    JSON.stringify(otherNode.initialData.options) !==
                      JSON.stringify(matchingChildNode.data.options)
                  ) {
                    updates = {
                      initialData: {
                        ...otherNode.initialData,
                        dataType: 'option',
                        options: matchingChildNode.data.options || [],
                      },
                    };
                  }
                } else {
                  if (otherNode.initialData.dataType === 'option') {
                    updates = {
                      initialData: {
                        ...otherNode.initialData,
                        dataType: 'any',
                        options: [],
                      },
                    };
                  }
                }

                if (updates) {
                  handleNodeUpdate(otherNode.id, updates);
                }
              }
            } catch (e) {
              console.error('Failed to configure connected node', e);
            }
          }
        }
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
