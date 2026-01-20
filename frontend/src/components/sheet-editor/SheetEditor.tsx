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
import { api, type Sheet } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useNodeOperations } from '../../hooks/useNodeOperations';
import { useReteEvents } from '../../hooks/useReteEvents';
import { useSheetCalculation } from '../../hooks/useSheetCalculation';
import { useSheetLock } from '../../hooks/useSheetLock';
import { useSheetManager } from '../../hooks/useSheetManager';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { createEditor, type ParascopeNode } from '../../rete';
import type { NodeType } from '../../rete/types';
import { createSocket, extractValuesFromResult } from '../../utils';
import { EditorBar } from '../EditorBar';
import { NavBar } from '../NavBar';
import { NodeInspector } from '../node-inspector';
import { SheetPickerModal } from '../SheetPickerModal';
import { SheetUsageModal } from '../SheetUsageModal';
import { SheetTable } from '../sheet-table';
import { TooltipLayer } from '../TooltipLayer';
import { VersionListModal } from '../VersionListModal';
import './SheetEditor.css';
import type { CalculationInputDefinition } from './types';
import { useEditorSetup } from './useEditorSetup';
import { useSheetClipboard } from './useSheetClipboard';
import { useUrlSync } from './useUrlSync';

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
  const [calculationInputs, setCalculationInputs] = useState<
    Record<string, string>
  >({});
  const [editingNode, setEditingNode] = useState<ParascopeNode | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSheetPickerOpen, setIsSheetPickerOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [isVersionListOpen, setIsVersionListOpen] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const lastResultRef = useRef(lastResult);
  lastResultRef.current = lastResult;
  const calculationInputsRef = useRef(calculationInputs);
  calculationInputsRef.current = calculationInputs;

  // Lock logic
  const {
    lockedByOther,
    isLockedByMe,
    takeOver,
    isLoading: isLockLoading,
  } = useSheetLock(sheetId || null);

  // Derive Read only state.
  const isVersionView = searchParams.has('versionId');
  const isReadOnly = !isLockedByMe || isLockLoading || isVersionView;

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
      name: 'Preview',
      nodes,
      connections,
    };
  }, [editor]);

  const {
    currentSheet,
    setCurrentSheet,
    isLoading,
    setIsLoading,
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
        const nodes = [...editor.instance.getNodes()];
        nodes.forEach((n) => {
          const pos = editor.area.nodeViews.get(n.id)?.position;
          if (pos) {
            n.x = pos.x;
            n.y = pos.y;
          }
        });
        setNodes(nodes);
        setInitialLoadDone(true);
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
      // Use latest calculation inputs
      const currentCalculationInputs = calculationInputsRef.current;
      const nodes = editor?.instance.getNodes() || [];

      Object.entries(currentCalculationInputs).forEach(([id, value]) => {
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
        setNodes([...editor.instance.getNodes()]);
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

  const handleCalculationInputChange = useCallback(
    (id: string, value: string) => {
      setCalculationInputs((prev) => {
        if (prev[id] === value) return prev;
        return { ...prev, [id]: value };
      });
    },
    [],
  );

  const {
    addNode,
    removeNode,
    handleDuplicateNode,
    handleNodeUpdate: originalHandleNodeUpdate,
    calcCenterPosition,
  } = useNodeOperations(
    editor,
    editor?.area,
    nodes,
    setIsDirty,
    currentSheet,
    handleCalculationInputChange,
    editor?.addHistoryAction,
  );

  const handleNodeUpdate = useCallback(
    async (nodeId: string, updates: any) => {
      await originalHandleNodeUpdate(nodeId, updates);
      triggerAutoCalculation();
    },
    [originalHandleNodeUpdate, triggerAutoCalculation],
  );

  // Trigger auto-calculation when calculation inputs change (e.g. from URL source)
  useEffect(() => {
    // Only trigger if we are past the initial load phase
    if (initialLoadDone) {
      triggerAutoCalculation();
    }
  }, [calculationInputs, triggerAutoCalculation, initialLoadDone]);

  const { handleCopy, handlePaste } = useSheetClipboard(
    addNode,
    calcCenterPosition,
    editor,
  );

  const handleDelete = useCallback(
    async (nodeIds: string[]) => {
      for (const id of nodeIds) {
        const node = editor?.instance.getNode(id);
        if (node && (node.type === 'input' || node.type === 'output')) {
          if (
            !window.confirm(
              `Deleting this ${node.type} node may break sheets that use this sheet as a function. Are you sure?`,
            )
          ) {
            continue;
          }
        }
        await removeNode(id);
      }
    },
    [editor, removeNode],
  );

  const handleViewportChange = useCallback(() => {
    if (window.location.hash) {
      navigate(
        {
          pathname: location.pathname,
          search: location.search,
        },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate]);

  const onSave = useCallback(() => {
    // Sync current results to node data so they are included in the export/save
    if (editor) {
      editor.updateNodeValues(calculationInputsRef.current, lastResult || {});
    }
    handleSaveSheet(getExportData());
  }, [handleSaveSheet, getExportData, editor, lastResult]);

  const handleRestoreVersion = useCallback(
    async (version: any) => {
      // 1. Load version data
      if (editor && version.data) {
        const tempSheet = {
          ...currentSheet,
          ...version.data,
          id: currentSheet?.id,
          name: currentSheet?.name,
        };

        await editor.loadSheet(tempSheet as any);
        const nodes = [...editor.instance.getNodes()];
        nodes.forEach((n) => {
          const pos = editor.area.nodeViews.get(n.id)?.position;
          if (pos) {
            n.x = pos.x;
            n.y = pos.y;
          }
        });
        setNodes(nodes);

        // 2. Mark as dirty
        setIsDirty(true);

        // 3. Trigger calc
        triggerAutoCalculation();

        toast.success(`Restored to version ${version.version_tag}`);
      }
    },
    [editor, currentSheet, triggerAutoCalculation],
  );

  useReteEvents(
    editor || undefined,
    {
      setEditingNode,
      handleDuplicateNode,
      handleNodeUpdate,
      setIsDirty,
      setNodes,
      triggerAutoCalculation,
      handleCalculationInputChange,
      onCopy: handleCopy,
      onPaste: handlePaste,
      onDelete: handleDelete,
      onViewportChange: handleViewportChange,
      onSave,
    },
    { lastResultRef, calculationInputsRef },
  );

  // Load the specific sheet when sheetId changes
  useEffect(() => {
    const versionId = searchParams.get('versionId');
    if (sheetId) {
      if (versionId) {
        setIsLoading(true);
        Promise.all([api.getVersion(sheetId, versionId), api.getSheet(sheetId)])
          .then(([v, liveSheet]) => {
            if (editor && v.data) {
              const tempSheet = {
                ...v.data,
                id: sheetId,
                name: `${liveSheet.name} (${v.version_tag})`,
                version_tag: v.version_tag,
              };
              setCurrentSheet(tempSheet);
              editor.loadSheet(tempSheet).then(() => {
                setNodes([...editor.instance.getNodes()]);
                setInitialLoadDone(true);
                setIsLoading(false);
              });
            } else {
              setIsLoading(false);
            }
          })
          .catch(() => setIsLoading(false));
      } else {
        handleLoadSheet(sheetId);
        setInitialLoadDone(false);
      }
    }
  }, [
    sheetId,
    handleLoadSheet,
    searchParams,
    editor,
    setIsLoading,
    setCurrentSheet,
  ]);

  useUrlSync({
    nodes,
    searchParams,
    setSearchParams,
    calculationInputs,
    setCalculationInputs,
    initialLoadDone,
    setInitialLoadDone,
  });

  // Handle Hash Changes for Focus
  useEffect(() => {
    if (editor && location.hash) {
      const nodeId = location.hash.substring(1);
      editor.zoomToNode(nodeId);
    }
  }, [editor, location.hash]);

  // Sync Calculation Inputs back to Graph Nodes and Table View
  useEffect(() => {
    if (editor) {
      editor.updateNodeValues(calculationInputs, lastResult || {});
      const nodes = [...editor.instance.getNodes()];
      nodes.forEach((n) => {
        const pos = editor.area.nodeViews.get(n.id)?.position;
        if (pos) {
          n.x = pos.x;
          n.y = pos.y;
        }
      });
      setNodes(nodes);
    }
  }, [editor, calculationInputs, lastResult]);

  const handleAddNode = async (type: NodeType) => {
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
      case 'comment':
        label = 'Comment';
        data = { description: 'Add your comment here...' };
        break;
      case 'lut':
        label = 'LUT';
        inputs = [createSocket('key')];
        outputs = [createSocket('Output 1')];
        data = {
          lut: {
            rows: [{ key: 'Key 1', values: { 'Output 1': 0 } }],
          },
        };
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
        .filter(
          (n: { type: string }) => n.type === 'output' || n.type === 'constant',
        )
        .map((n: { label: string; type: string }) => ({
          key: n.label,
          socket_type: n.type,
        }));

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
  const inputProps = useMemo(() => {
    if (!currentSheet) return { inputs: [], outputs: [] };
    const sourceNodes = nodes.length > 0 ? nodes : [];

    const sortedNodes = [...sourceNodes].sort((a, b) => {
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });

    const inputs: CalculationInputDefinition[] = sortedNodes
      .filter((n) => n.type === 'input' && n.id)
      .map((n) => ({
        id: n.id!,
        label: n.label,
        value:
          calculationInputs[n.id!] !== undefined
            ? calculationInputs[n.id!]
            : '',
      }));

    return { inputs };
  }, [currentSheet, nodes, calculationInputs]);

  useEffect(() => {
    if (editor) {
      const inputValues: Record<string, any> = {};
      inputProps.inputs.forEach((i) => {
        inputValues[i.id] = i.value;
      });
      editor.updateNodeValues(
        inputValues,
        lastResult ? extractValuesFromResult(lastResult) : {},
      );
    }
  }, [editor, inputProps, lastResult]);

  const handleCalculate = async () => {
    if (!currentSheet) return;
    const graph = getExportData();
    if (!graph) return;

    try {
      const apiInputs: Record<string, { value: any }> = {};
      Object.entries(calculationInputs).forEach(([id, value]) => {
        const node = nodes.find((n) => n.id === id);
        if (node) {
          apiInputs[node.label] = { value };
        }
      });

      const result = await calculatePreview(apiInputs, graph, true);

      if (editor && result) {
        editor.updateNodeValues(
          {}, // Do not update inputs from calculation result
          extractValuesFromResult(result),
        );
        setNodes([...editor.instance.getNodes()]);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`Error calculating: ${e.message}`);
    }
  };

  const handleUpdateNodeValue = (nodeId: string, value: string) => {
    if (!editor) return;
    const node = editor.instance.getNode(nodeId);
    if (!node) return;

    if (node.type === 'input') {
      handleCalculationInputChange(nodeId, value);
    } else {
      const control = node.controls.value as any;
      if (control) {
        control.setValue(value);
        editor.area.update('control', nodeId);
        setIsDirty(true);
        setNodes([...editor.instance.getNodes()]);
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

  const handleOpenNestedSheet = useCallback(
    (nodeId: string, newTab: boolean) => {
      if (!editor) return;
      const node = editor.instance.getNode(nodeId) as ParascopeNode;
      const params = new URLSearchParams();
      if (lastResult?.[nodeId]) {
        const nodeRes = lastResult[nodeId];
        for (const [inputKey, inputVal] of Object.entries(
          nodeRes.inputs || {},
        )) {
          params.set(inputKey, String(inputVal));
        }
      }
      const url = `/sheet/${node.data.sheetId}?${params.toString()}`;
      if (newTab) {
        window.open(url, '_blank');
      } else {
        handleSaveSheet(getExportData());
        navigate(url);
      }
    },
    [editor, lastResult, handleSaveSheet, getExportData, navigate],
  );

  useEditorSetup({
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
  });

  const handleImportInputs = useCallback(
    (inputs: Record<string, string>) => {
      if (!editor) return;
      const inputNodes = editor.instance
        .getNodes()
        .filter((n) => n.type === 'input');
      const newInputs: Record<string, string> = {};

      Object.entries(inputs).forEach(([label, value]) => {
        const node = inputNodes.find((n) => n.label === label);
        if (node) {
          newInputs[node.id] = value;
        }
      });

      setCalculationInputs((prev) => ({
        ...prev,
        ...newInputs,
      }));
    },
    [editor],
  );

  return (
    <div className="sheet-editor">
      <NavBar user={user} onBack={handleBackClick} onLogout={logout} />
      {isVersionView && (
        <div
          className="lock-banner"
          style={{
            backgroundColor: '#e3f2fd',
            color: '#0d47a1',
            borderColor: '#90caf9',
          }}
        >
          <span>
            Viewing{' '}
            <strong>
              Version Snapshot ({(currentSheet as any)?.version_tag})
            </strong>
            . Read-Only Mode.
          </span>
          <button
            type="button"
            onClick={() => navigate(`/sheet/${sheetId}`)}
            className="take-over-btn"
            style={{ backgroundColor: '#1976d2' }}
          >
            Back to Live
          </button>
        </div>
      )}
      {!isVersionView && lockedByOther && (
        <div className="lock-banner">
          <span>
            Currently being edited by <strong>{lockedByOther}</strong>. You are
            in Read-Only mode.
          </span>
          <button type="button" onClick={takeOver} className="take-over-btn">
            Take Over
          </button>
        </div>
      )}
      {!isVersionView && !lockedByOther && isReadOnly && !isLockLoading && (
        <div className="lock-banner">
          <span>You are in Read-Only mode. Reload to acquire lock.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="take-over-btn"
          >
            Reload
          </button>
        </div>
      )}{' '}
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
                readOnly={isReadOnly}
                onRenameSheet={handleRenameSheet}
                onSaveSheet={onSave}
                onOpenVersionList={() => setIsVersionListOpen(true)}
                onAddNode={handleAddNode}
                onUndo={() => editor?.undo()}
                onRedo={() => editor?.redo()}
                onCheckUsage={() => setIsUsageModalOpen(true)}
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
              onSweep={() => window.open(`/sheet/${sheetId}/sweep`, '_blank')}
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
      {currentSheet && (
        <SheetUsageModal
          isOpen={isUsageModalOpen}
          onClose={() => setIsUsageModalOpen(false)}
          sheetId={currentSheet.id}
          onImportInputs={handleImportInputs}
        />
      )}
      {currentSheet && (
        <VersionListModal
          isOpen={isVersionListOpen}
          onClose={() => setIsVersionListOpen(false)}
          sheetId={currentSheet.id}
          onRestore={handleRestoreVersion}
        />
      )}
    </div>
  );
};
