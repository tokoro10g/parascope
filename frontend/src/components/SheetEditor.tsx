import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Group, Panel, Separator } from 'react-resizable-panels';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useRete } from 'rete-react-plugin';
import { api, type Sheet } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useNodeOperations } from '../hooks/useNodeOperations';
import { useSheetCalculation } from '../hooks/useSheetCalculation';
import { createEditor, type ParascopeNode } from '../rete';
import {
  createSocket,
  extractValuesFromResult,
  syncNestedSheets,
} from '../utils';
import { EditorBar } from './EditorBar';
import { NavBar } from './NavBar';
import { NodeInspector } from './NodeInspector';
import { SheetPickerModal } from './SheetPickerModal';
import { SheetTable } from './SheetTable';
import { TooltipLayer } from './TooltipLayer';
import './SheetEditor.css';

export interface EvaluatorInput {
  id: string;
  label: string;
  value: string | number;
}

export const SheetEditor: React.FC = () => {
  const { sheetId } = useParams<{ sheetId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ref, editor] = useRete(createEditor);
  const [currentSheet, setCurrentSheet] = useState<Sheet | null>(null);
  const [nodes, setNodes] = useState<ParascopeNode[]>([]);
  const {
    isCalculating,
    lastResult,
    setLastResult,
    errorNodeId,
    setErrorNodeId,
    calculate,
  } = useSheetCalculation(editor);
  const [evaluatorInputs, setEvaluatorInputs] = useState<
    Record<string, string>
  >({});
  const [editingNode, setEditingNode] = useState<ParascopeNode | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSheetPickerOpen, setIsSheetPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const lastResultRef = useRef(lastResult);
  lastResultRef.current = lastResult;
  const evaluatorInputsRef = useRef(evaluatorInputs);
  evaluatorInputsRef.current = evaluatorInputs;
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const ignoreNextSearchParamsChange = useRef(false);

  // Warn on exit if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = currentSheet?.folder_id
      ? `/folder/${currentSheet.folder_id}`
      : '/';

    if (isDirty) {
      if (
        window.confirm(
          'You have unsaved changes. Are you sure you want to leave?',
        )
      ) {
        navigate(target);
      }
    } else {
      navigate(target);
    }
  };

  const handleEvaluatorInputChange = useCallback(
    (id: string, value: string) => {
      if (
        evaluatorInputsRef.current &&
        evaluatorInputsRef.current[id] === value
      ) {
        return;
      }

      setEvaluatorInputs((prev) => ({ ...prev, [id]: value }));

      if (errorNodeId === id) {
        setErrorNodeId(null);
      }

      const node = editor?.editor.getNode(id);
      const label = node?.label;

      if (!label) return;

      ignoreNextSearchParamsChange.current = true;
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev);
          if (value) {
            newParams.set(label, value);
          } else {
            newParams.delete(label);
          }
          return newParams;
        },
        { replace: true },
      );
    },
    [errorNodeId, setSearchParams, editor, setErrorNodeId],
  );

  const { addNode, handleDuplicateNode, handleNodeUpdate, calcCenterPosition } =
    useNodeOperations(
      editor?.editor,
      editor?.area,
      nodes,
      setNodes,
      setIsDirty,
      setCurrentSheet,
      currentSheet,
      handleEvaluatorInputChange,
      editor?.addHistoryAction,
    );

  const handleLoadSheet = useCallback(
    async (id: string) => {
      if (!editor) return;
      setIsLoading(true);
      try {
        const sheet = await api.getSheet(id);

        // --- SYNC NESTED SHEETS ---
        const { updatedNodes, connectionsChanged, validConnectionIds } =
          await syncNestedSheets(sheet);

        sheet.nodes = updatedNodes;
        if (connectionsChanged) {
          sheet.connections = sheet.connections.filter(
            (c) => c.id && validConnectionIds.has(c.id),
          );
          console.warn(
            'Removed invalid connections due to nested sheet updates',
          );
          alert(
            'Some connections were removed because the inputs/outputs of nested sheets have changed.',
          );
        }
        // --------------------------

        setCurrentSheet(sheet);
        setLastResult(null);
        // Note: evaluatorInputs are handled by the useEffect on searchParams

        const focusNodeId = window.location.hash
          ? window.location.hash.substring(1)
          : undefined;
        await editor.loadSheet(sheet, focusNodeId);
        const nodes = [...editor.editor.getNodes()];
        nodes.forEach((n) => {
          const pos = editor.area.nodeViews.get(n.id)?.position;
          if (pos) {
            n.x = pos.x;
            n.y = pos.y;
          }
        });
        setNodes(nodes);
        setIsDirty(false);
        setIsLoading(false);
        document.title = `Parascope - ${sheet.name}`;

        // Auto-calculate (UI-27.0)
        const inputNodes = sheet.nodes.filter((n) => n.type === 'input');
        const inputsFromParams: Record<string, string> = {};
        searchParamsRef.current.forEach((value, key) => {
          // Map Name -> ID
          const node = inputNodes.find((n) => n.label === key);
          if (node?.id) {
            inputsFromParams[node.id] = value;
          }
        });

        const allInputsProvided = inputNodes.every(
          (n) => n.id && inputsFromParams[n.id],
        );

        if (inputNodes.length === 0 || allInputsProvided) {
          try {
            const apiInputs: Record<string, { value: any }> = {};
            Object.entries(inputsFromParams).forEach(([id, value]) => {
              const node = inputNodes.find((n) => n.id === id);
              if (node) {
                apiInputs[node.label] = { value };
              }
            });

            const result = await calculate(sheet.id, apiInputs);

            editor.updateNodeValues(
              inputsFromParams,
              extractValuesFromResult(result),
            );
            setNodes([...editor.editor.getNodes()]);
          } catch (e) {
            console.error('Auto-calculation failed', e);
          }
        }
      } catch (e) {
        console.error(e);
        alert(`Error loading sheet: ${e}`);
      }
    },
    [editor, calculate, setLastResult],
  );

  // Load the specific sheet when sheetId changes
  useEffect(() => {
    if (sheetId) {
      handleLoadSheet(sheetId);
    }
  }, [sheetId, handleLoadSheet]);

  // Sync URL Query Params to Evaluator Inputs
  useEffect(() => {
    if (ignoreNextSearchParamsChange.current) {
      ignoreNextSearchParamsChange.current = false;
      return;
    }

    if (nodes.length === 0) return;

    const overrides: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      const node = nodes.find((n) => n.type === 'input' && n.label === key);
      if (node?.id) {
        overrides[node.id] = value;
      }
    });
    setEvaluatorInputs((prev) => {
      const prevKeys = Object.keys(prev);
      const newKeys = Object.keys(overrides);
      if (prevKeys.length !== newKeys.length) return overrides;

      for (const key of newKeys) {
        if (prev[key] !== overrides[key]) return overrides;
      }

      return prev;
    });
  }, [searchParams, nodes]);

  // Handle Hash Changes for Focus
  useEffect(() => {
    if (editor && location.hash) {
      const nodeId = location.hash.substring(1);
      editor.zoomToNode(nodeId);
    }
  }, [editor, location.hash]);

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
        onNodeTypeChange: (nodeId, type) => {
          handleNodeUpdate(nodeId, { type });
        },
        onNodeRemove: async (nodeId) => {
          const node = editor.editor.getNode(nodeId);
          if (node && (node.type === 'input' || node.type === 'output')) {
            return window.confirm(
              `Deleting this ${node.type} node may break sheets that use this sheet as a function. Are you sure?`,
            );
          }
          return true;
        },
        onEditNestedSheet: (nodeId) => {
          const node = editor.editor.getNode(nodeId);
          if (node?.initialData?.sheetId) {
            const connections = editor.editor
              .getConnections()
              .filter((c) => c.target === nodeId);
            const queryParams = new URLSearchParams();

            connections.forEach((c) => {
              const sourceId = c.source;
              const inputKey = c.targetInput;
              let value: any;

              // 1. Check lastResult (calculated values)
              if (lastResultRef.current && sourceId in lastResultRef.current) {
                const nodeResult = lastResultRef.current[sourceId];
                value = nodeResult?.outputs?.[c.sourceOutput];
              }
              // 2. Check evaluatorInputs (if source is an input node)
              else if (
                evaluatorInputsRef.current &&
                sourceId in evaluatorInputsRef.current
              ) {
                value = evaluatorInputsRef.current[sourceId];
              }
              // 3. Check node control value (fallback for constants/inputs)
              else {
                const sourceNode = editor.editor.getNode(sourceId);
                if (sourceNode?.controls?.value) {
                  const control = sourceNode.controls.value as any;
                  if (control && control.value !== undefined) {
                    value = control.value;
                  }
                }
              }

              if (value !== undefined) {
                const stringValue =
                  typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value);
                queryParams.set(inputKey, stringValue);
              }
            });

            const queryString = queryParams.toString();
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
      });
      editor.setInputValueChangeListener((nodeId, value) => {
        handleEvaluatorInputChange(nodeId, value);
      });
      editor.setContextMenuCallbacks({
        onNodeDuplicate: handleDuplicateNode,
      });
    }
  }, [
    editor,
    handleEvaluatorInputChange,
    handleNodeUpdate,
    handleDuplicateNode,
  ]);

  // Sync Evaluator Inputs back to Graph Nodes and Table View
  useEffect(() => {
    if (editor) {
      editor.updateNodeValues(evaluatorInputs, lastResult || {});
      const nodes = [...editor.editor.getNodes()];
      nodes.forEach((n) => {
        const pos = editor.area.nodeViews.get(n.id)?.position;
        if (pos) {
          n.x = pos.x;
          n.y = pos.y;
        }
      });
      setNodes(nodes);
    }
  }, [editor, evaluatorInputs, lastResult]);

  const handleSaveSheet = useCallback(async () => {
    if (!currentSheet || !editor) return;
    try {
      const graphData = editor.getGraphData();

      const nodes = graphData.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        position_x: n.position_x,
        position_y: n.position_y,
        inputs: n.inputs,
        outputs: n.outputs,
        data: n.data,
      }));

      const connections = graphData.connections.map((c) => ({
        id: c.id,
        source_id: c.source_id,
        target_id: c.target_id,
        source_port: c.source_port,
        target_port: c.target_port,
      }));

      const updatedSheet = await api.updateSheet(currentSheet.id, {
        nodes,
        connections,
      });

      setCurrentSheet(updatedSheet);
      setIsDirty(false);
      toast.success('Sheet saved successfully');
    } catch (e) {
      console.error(e);
      alert(`Error saving sheet: ${e}`);
    }
  }, [currentSheet, editor]);

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editor) return;

      // Ignore if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            editor.redo();
          } else {
            editor.undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          editor.redo();
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleSaveSheet();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, handleSaveSheet]);

  const handleRenameSheet = async (name: string) => {
    if (!currentSheet) return;
    try {
      const updatedSheet = await api.updateSheet(currentSheet.id, { name });
      setCurrentSheet(updatedSheet);
      toast.success('Sheet renamed successfully');
      // Renaming saves immediately, so we can clear dirty if it was only dirty due to name?
      // But usually renaming is separate. If we treat renaming as a save, we might want to keep dirty if graph changed.
      // However, the API call updates the sheet. If we don't send nodes, they aren't touched.
      // So renaming doesn't save the graph.
      // If the graph was dirty, it remains dirty.
      // If the graph was clean, renaming keeps it clean (since it's saved).
    } catch (e) {
      console.error(e);
      alert(`Error renaming sheet: ${e}`);
    }
  };

  const handleAddNode = async (
    type: 'parameter' | 'function' | 'input' | 'output' | 'sheet',
  ) => {
    if (!editor || !currentSheet) return;

    if (type === 'sheet') {
      setIsSheetPickerOpen(true);
      return;
    }

    let label: string = type;
    let inputs: { key: string; socket_type: string }[] = [];
    let outputs: { key: string; socket_type: string }[] = [];
    let data: Record<string, any> = {};

    switch (type) {
      case 'parameter':
        label = 'Parameter';
        outputs = [createSocket('value')];
        data = { value: 0 };
        break;
      case 'function':
        label = 'Function';
        inputs = [createSocket('x')];
        outputs = [createSocket('result')];
        data = { code: 'result = x' };
        break;
      case 'input':
        label = 'Input';
        outputs = [createSocket('value')];
        data = {};
        break;
      case 'output':
        label = 'Output';
        inputs = [createSocket('value')];
        break;
    }

    const centerPos = calcCenterPosition();
    await addNode(
      type,
      label,
      inputs,
      outputs,
      data,
      centerPos,
      true,
      setEditingNode,
    );
  };

  const handleImportSheet = async (sheet: Sheet) => {
    setIsSheetPickerOpen(false);
    if (!editor || !currentSheet) return;

    try {
      // Fetch full sheet details to get inputs/outputs
      const fullSheet = await api.getSheet(sheet.id);

      const inputs = fullSheet.nodes
        .filter((n) => n.type === 'input')
        .map((n) => createSocket(n.label));

      const outputs = fullSheet.nodes
        .filter((n) => n.type === 'output')
        .map((n) => createSocket(n.label));

      const type = 'sheet';
      const label = sheet.name;
      const data = { sheetId: sheet.id };

      const centerPos = calcCenterPosition();
      await addNode(type, label, inputs, outputs, data, centerPos);
    } catch (e) {
      console.error(e);
      alert(`Error importing sheet: ${e}`);
    }
  };

  // Derive Evaluator Props
  const evaluatorProps = useMemo(() => {
    if (!currentSheet) return { inputs: [], outputs: [] };

    // Use nodes state if available (for live position updates), otherwise fallback to currentSheet
    // But currentSheet.nodes are NodeData, nodes are ParascopeNode.
    // We need to normalize or just use nodes if we are sure it's populated.
    // nodes is populated after loadSheet.

    const sourceNodes = nodes.length > 0 ? nodes : [];

    const sortedNodes = [...sourceNodes].sort((a, b) => {
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });

    const inputs: EvaluatorInput[] = sortedNodes
      .filter((n) => n.type === 'input' && n.id)
      .map((n) => ({
        id: n.id!,
        label: n.label,
        value:
          evaluatorInputs[n.id!] !== undefined ? evaluatorInputs[n.id!] : '',
      }));

    return { inputs };
  }, [currentSheet, nodes, evaluatorInputs]);

  useEffect(() => {
    if (editor) {
      const inputValues: Record<string, any> = {};
      evaluatorProps.inputs.forEach((i) => {
        inputValues[i.id] = i.value;
      });
      editor.updateNodeValues(
        inputValues,
        lastResult ? extractValuesFromResult(lastResult) : {},
      );
    }
  }, [editor, evaluatorProps, lastResult]);

  const handleCalculate = async () => {
    if (!currentSheet) return;
    try {
      await handleSaveSheet();

      const apiInputs: Record<string, { value: any }> = {};
      Object.entries(evaluatorInputs).forEach(([id, value]) => {
        const node = nodes.find((n) => n.id === id);
        if (node) {
          apiInputs[node.label] = { value };
        }
      });

      const result = await calculate(currentSheet.id, apiInputs);

      if (editor) {
        editor.updateNodeValues(
          evaluatorInputs,
          extractValuesFromResult(result),
        );
        setNodes([...editor.editor.getNodes()]);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error calculating: ${e.message}`);
    }
  };

  const handleUpdateNodeValue = (nodeId: string, value: string) => {
    if (!editor) return;
    const node = editor.editor.getNode(nodeId);
    if (!node) return;

    if (node.type === 'input') {
      // For input nodes, the source of truth is the Evaluator/URL.
      // We update that, and let the useEffect sync it back to the node.
      handleEvaluatorInputChange(nodeId, value);
    } else {
      // For parameter nodes, the source of truth is the node itself.
      const control = node.controls.value as any;
      if (control) {
        control.setValue(value);
        editor.area.update('control', nodeId);
        setIsDirty(true);
        setNodes([...editor.editor.getNodes()]);
      }
    }
  };

  const handleSelectNode = (nodeId: string) => {
    if (!editor) return;
    editor.zoomToNode(nodeId);
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: `#${nodeId}`,
      },
      { replace: true },
    );
  };

  return (
    <div className="sheet-editor">
      <NavBar user={user} onBack={handleBackClick} onLogout={logout} />
      <div
        className="editor-content"
        style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
        <Group
          orientation="horizontal"
          style={{ width: '100%', height: '100%' }}
        >
          <Panel defaultSize={70} minSize={30}>
            <div
              className="rete-container"
              style={{ width: '100%', height: '100%', position: 'relative' }}
            >
              {isLoading && <div className="loading-overlay">Loading...</div>}
              <EditorBar
                sheetName={currentSheet?.name}
                isDirty={isDirty}
                onRenameSheet={handleRenameSheet}
                onSaveSheet={handleSaveSheet}
                onAddNode={handleAddNode}
                onUndo={() => editor?.undo()}
                onRedo={() => editor?.redo()}
              />
              <div
                ref={ref}
                className="rete"
                style={{ opacity: isLoading ? 0 : 1 }}
              />
              <TooltipLayer editor={editor} />
            </div>
          </Panel>
          <Separator
            style={{ width: '4px', background: '#ccc', cursor: 'col-resize' }}
          />
          <Panel defaultSize={30} minSize={10}>
            <SheetTable
              nodes={nodes}
              onUpdateValue={handleUpdateNodeValue}
              onSelectNode={handleSelectNode}
              onCalculate={handleCalculate}
              isCalculating={isCalculating}
            />
          </Panel>
        </Group>
      </div>
      <NodeInspector
        node={editingNode}
        isOpen={!!editingNode}
        onClose={() => setEditingNode(null)}
        onSave={handleNodeUpdate}
      />
      <SheetPickerModal
        isOpen={isSheetPickerOpen}
        onClose={() => setIsSheetPickerOpen(false)}
        onSelect={handleImportSheet}
      />
    </div>
  );
};
