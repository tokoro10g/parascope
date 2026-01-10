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
import { useReteEvents } from '../hooks/useReteEvents';
import { useSheetCalculation } from '../hooks/useSheetCalculation';
import { useSheetManager } from '../hooks/useSheetManager';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { createEditor, type ParascopeNode } from '../rete';
import { createSocket, extractValuesFromResult } from '../utils';
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
  const [nodes, setNodes] = useState<ParascopeNode[]>([]);
  const { isCalculating, lastResult, setLastResult, calculatePreview } =
    useSheetCalculation(editor);
  const [evaluatorInputs, setEvaluatorInputs] = useState<
    Record<string, string>
  >({});
  const [editingNode, setEditingNode] = useState<ParascopeNode | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSheetPickerOpen, setIsSheetPickerOpen] = useState(false);

  const lastResultRef = useRef(lastResult);
  lastResultRef.current = lastResult;
  const evaluatorInputsRef = useRef(evaluatorInputs);
  evaluatorInputsRef.current = evaluatorInputs;
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const calculateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useUnsavedChanges(isDirty);

  const getExportData = useCallback(() => {
    if (!editor) return { nodes: [], connections: [] };
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

    return {
      nodes,
      connections,
    };
  }, [editor]);

  const {
    currentSheet,
    setCurrentSheet,
    isLoading,
    handleLoadSheet,
    handleSaveSheet,
    handleRenameSheet,
  } = useSheetManager(
    useCallback(
      async (sheet) => {
        if (!editor) return;
        setLastResult(null);

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
      },
      [editor, setLastResult],
    ),
    setIsDirty,
  );

  const triggerAutoCalculation = useCallback(() => {
    if (calculateTimeoutRef.current) {
      clearTimeout(calculateTimeoutRef.current);
    }

    calculateTimeoutRef.current = setTimeout(async () => {
      const graph = getExportData();
      if (!graph.nodes.length) return;

      const fullGraph = {
        name: currentSheet?.name || 'Untitled',
        ...graph,
      };

      const apiInputs: Record<string, { value: any }> = {};
      // Use latest evaluator inputs
      const currentEvaluatorInputs = evaluatorInputsRef.current;
      const nodes = editor?.editor.getNodes() || [];

      Object.entries(currentEvaluatorInputs).forEach(([id, value]) => {
        const node = nodes.find((n) => n.id === id);
        if (node) {
          apiInputs[node.label] = { value };
        }
      });

      const result = await calculatePreview(apiInputs, fullGraph);
      if (editor && result) {
        editor.updateNodeValues(
          {}, // Do not update inputs from calculation result (they are controlled locally)
          extractValuesFromResult(result),
        );
        setNodes([...editor.editor.getNodes()]);
      }
    }, 50); // 50ms debounce
  }, [getExportData, calculatePreview, editor, currentSheet]);

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = currentSheet?.folder_id
      ? `/folder/${currentSheet.folder_id}`
      : '/';

    // Navigation is handled by useBlocker
    navigate(target);
  };

  const handleEvaluatorInputChange = useCallback(
    (id: string, value: string) => {
      if (
        evaluatorInputsRef.current &&
        evaluatorInputsRef.current[id] === value
      ) {
        return;
      }

      const node = editor?.editor.getNode(id);
      const label = node?.label;

      if (!label) return;

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
    [setSearchParams, editor],
  );

  const {
    addNode,
    handleDuplicateNode,
    handleNodeUpdate: originalHandleNodeUpdate,
    calcCenterPosition,
  } = useNodeOperations(
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

  const handleNodeUpdate = useCallback(
    async (nodeId: string, updates: any) => {
      await originalHandleNodeUpdate(nodeId, updates);
      triggerAutoCalculation();
    },
    [originalHandleNodeUpdate, triggerAutoCalculation],
  );

  // Trigger auto-calculation when evaluator inputs change (e.g. from URL source)
  useEffect(() => {
    triggerAutoCalculation();
  }, [evaluatorInputs, triggerAutoCalculation]);

  useReteEvents(
    editor || undefined,
    {
      setEditingNode,
      handleDuplicateNode,
      handleNodeUpdate,
      setIsDirty,
      setNodes,
      triggerAutoCalculation,
      handleEvaluatorInputChange,
    },
    { lastResultRef, evaluatorInputsRef },
  );

  // Load the specific sheet when sheetId changes
  useEffect(() => {
    if (sheetId) {
      handleLoadSheet(sheetId);
    }
  }, [sheetId, handleLoadSheet]);

  // Sync URL Query Params to Evaluator Inputs
  useEffect(() => {
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

  const onSave = useCallback(() => {
    handleSaveSheet(getExportData());
  }, [handleSaveSheet, getExportData]);

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
          onSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, onSave]);

  const handleAddNode = async (
    type: 'constant' | 'function' | 'input' | 'output' | 'sheet',
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
      case 'constant':
        label = 'Constant';
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
        .filter((n: { type: string }) => n.type === 'input')
        .map((n: { label: string }) => createSocket(n.label));

      const outputs = fullSheet.nodes
        .filter((n: { type: string }) => n.type === 'output')
        .map((n: { label: string }) => createSocket(n.label));

      const type = 'sheet';
      const label = sheet.name;
      const data = { sheetId: sheet.id };

      const centerPos = calcCenterPosition();
      await addNode(type, label, inputs, outputs, data, centerPos);
    } catch (e) {
      console.error(e);
      toast.error(`Error importing sheet: ${e}`);
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
    const graph = getExportData();
    if (!graph) return;

    try {
      const apiInputs: Record<string, { value: any }> = {};
      Object.entries(evaluatorInputs).forEach(([id, value]) => {
        const node = nodes.find((n) => n.id === id);
        if (node) {
          apiInputs[node.label] = { value };
        }
      });

      const result = await calculatePreview(apiInputs, graph);

      if (editor && result) {
        editor.updateNodeValues(
          {}, // Do not update inputs from calculation result
          extractValuesFromResult(result),
        );
        setNodes([...editor.editor.getNodes()]);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`Error calculating: ${e.message}`);
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
      // For constant nodes, the source of truth is the node itself.
      const control = node.controls.value as any;
      if (control) {
        control.setValue(value);
        editor.area.update('control', nodeId);
        setIsDirty(true);
        setNodes([...editor.editor.getNodes()]);
        triggerAutoCalculation();
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
                onSaveSheet={onSave}
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
              onSweep={() => navigate(`/sheet/${sheetId}/sweep`)}
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
