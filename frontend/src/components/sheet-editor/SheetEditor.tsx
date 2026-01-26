import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Group,
  type PanelImperativeHandle,
  Separator,
} from 'react-resizable-panels';
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
import { NavBar } from '../NavBar';
import './SheetEditor.css';

// Extracted UI Components
import { SheetEditorModals } from './modals/SheetEditorModals';
import type { CalculationInputDefinition } from './types';
import { SheetEditorPanel } from './ui/SheetEditorPanel';
import { SheetMobileTabs } from './ui/SheetMobileTabs';
import { SheetStatusBanner } from './ui/SheetStatusBanner';
import { SheetTablePanel } from './ui/SheetTablePanel';
import { useEditorSetup } from './useEditorSetup';
import { useSheetClipboard } from './useSheetClipboard';
import { useUrlSync } from './useUrlSync';

export const SheetEditor: React.FC = () => {
  const { sheetId } = useParams<{ sheetId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
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
  const [isTakeOverModalOpen, setIsTakeOverModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const initialLoadDoneRef = useRef(false);
  const [defaultVersionTag, setDefaultVersionTag] = useState<string | null>(
    null,
  );
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeTab, setActiveTab] = useState<
    'editor' | 'variables' | 'descriptions'
  >('editor');
  const editorPanelRef = useRef<PanelImperativeHandle>(null);
  const tablePanelRef = useRef<PanelImperativeHandle>(null);

  // Programmatically resize panels on mobile to ensure full-width tabs
  useEffect(() => {
    const resizePanels = () => {
      if (isMobile) {
        if (activeTab === 'editor') {
          editorPanelRef.current?.resize(100);
          tablePanelRef.current?.resize(0);
        } else {
          editorPanelRef.current?.resize(0);
          tablePanelRef.current?.resize(100);
        }
      } else {
        // Only force desktop split once when entering desktop mode
        // to avoid resetting user-defined widths when switching Variables/Descriptions tabs
        const currentEditorSize = editorPanelRef.current?.getSize();
        if (
          currentEditorSize?.asPercentage === 0 ||
          currentEditorSize?.asPercentage === 100
        ) {
          editorPanelRef.current?.resize(70);
          tablePanelRef.current?.resize(30);
        }
      }
    };

    // Small delay to let DOM settle during resize/tab switch
    const timer = setTimeout(resizePanels, 0);
    return () => clearTimeout(timer);
  }, [isMobile, activeTab]);

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

  // Reset load ref if sheetId, versionId or editor instance changes (HMR)
  const versionId = searchParams.get('versionId');
  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to trigger reload on ID, version or editor instance change
  useEffect(() => {
    initialLoadDoneRef.current = false;
  }, [sheetId, versionId, editor]);

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

  // Fetch default version tag when default_version_id changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);

    if (currentSheet?.default_version_id && sheetId) {
      api
        .getVersion(sheetId, currentSheet.default_version_id)
        .then((v) => setDefaultVersionTag(v.version_tag))
        .catch((e) => console.error('Failed to fetch default version tag', e));
    } else {
      setDefaultVersionTag(null);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [currentSheet?.default_version_id, sheetId]);

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
    calcCursorPosition,
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: Calculation should be triggered by calculationInputs
  useEffect(() => {
    // Only trigger if we are past the initial load phase
    if (initialLoadDone) {
      triggerAutoCalculation();
    }
  }, [calculationInputs, triggerAutoCalculation, initialLoadDone]);

  const { handleCopy, handlePaste } = useSheetClipboard(
    addNode,
    calcCursorPosition,
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
      editor.updateNodeValues(
        calculationInputsRef.current,
        extractValuesFromResult(lastResult || {}),
      );
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

  const handleSetDefault = useCallback(
    async (versionId: string | null) => {
      if (!currentSheet) return;
      try {
        const updatedSheet = await api.setDefaultVersion(
          currentSheet.id,
          versionId,
        );
        setCurrentSheet((prev) =>
          prev
            ? { ...prev, default_version_id: updatedSheet.default_version_id }
            : null,
        );
        toast.success('Default version updated');
      } catch (e: any) {
        console.error(e);
        toast.error(`Failed to set default version: ${e.message}`);
      }
    },
    [currentSheet, setCurrentSheet],
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
    if (sheetId && editor && !initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
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
                default_version_id: liveSheet.default_version_id, // Keep live metadata
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
        handleLoadSheet(sheetId).finally(() => {
          setInitialLoadDone(true);
        });
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
    calculationInputs,
    setCalculationInputs,
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
      editor.updateNodeValues(
        calculationInputs,
        extractValuesFromResult(lastResult || {}),
      );
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
        data = {};
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
        data = {};
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
      // Default to live (undefined versionId) unless sheet has a default_version_id
      const data: any = { sheetId: sheet.id };
      if (fullSheet.default_version_id) {
        data.versionId = fullSheet.default_version_id;
      }

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

      <SheetStatusBanner
        isVersionView={isVersionView}
        lockedByOther={lockedByOther}
        isReadOnly={isReadOnly}
        isLockLoading={isLockLoading}
        currentSheet={currentSheet}
        defaultVersionTag={defaultVersionTag}
        sheetId={sheetId}
        setIsTakeOverModalOpen={setIsTakeOverModalOpen}
      />

      <SheetMobileTabs
        isMobile={isMobile}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <div
        className="editor-content"
        style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
        <div className="editor-main-wrapper">
          <Group
            id="editor-group"
            orientation="horizontal"
            style={{ width: '100%', height: '100%' }}
          >
            <SheetEditorPanel
              editorPanelRef={editorPanelRef}
              isMobile={isMobile}
              activeTab={activeTab}
              isLoading={isLoading}
              currentSheet={currentSheet}
              isDirty={isDirty}
              isReadOnly={isReadOnly}
              handleRenameSheet={handleRenameSheet}
              onSave={onSave}
              setIsVersionListOpen={setIsVersionListOpen}
              handleAddNode={handleAddNode}
              editor={editor}
              handleCopy={handleCopy}
              handlePaste={handlePaste}
              setIsUsageModalOpen={setIsUsageModalOpen}
              setIsHistoryModalOpen={setIsHistoryModalOpen}
              reteRef={ref}
            />

            <Separator
              style={{
                width: isMobile ? '0' : '4px',
                background: '#ccc',
                cursor: 'col-resize',
                display: isMobile ? 'none' : 'block',
              }}
            />

            <SheetTablePanel
              tablePanelRef={tablePanelRef}
              isMobile={isMobile}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              nodes={nodes}
              handleUpdateNodeValue={handleUpdateNodeValue}
              handleSelectNode={handleSelectNode}
              handleCalculate={handleCalculate}
              sheetId={sheetId}
              calculationInputs={calculationInputs}
              isCalculating={isCalculating}
              lastResult={lastResult}
            />
          </Group>
        </div>
      </div>

      <SheetEditorModals
        editingNode={editingNode}
        setEditingNode={setEditingNode}
        handleNodeUpdate={handleNodeUpdate}
        isSheetPickerOpen={isSheetPickerOpen}
        setIsSheetPickerOpen={setIsSheetPickerOpen}
        handleImportSheet={handleImportSheet}
        currentSheet={currentSheet}
        isUsageModalOpen={isUsageModalOpen}
        setIsUsageModalOpen={setIsUsageModalOpen}
        handleImportInputs={handleImportInputs}
        isVersionListOpen={isVersionListOpen}
        setIsVersionListOpen={setIsVersionListOpen}
        handleRestoreVersion={handleRestoreVersion}
        handleSetDefault={handleSetDefault}
        isDirty={isDirty}
        isHistoryModalOpen={isHistoryModalOpen}
        setIsHistoryModalOpen={setIsHistoryModalOpen}
        nodes={nodes}
        isTakeOverModalOpen={isTakeOverModalOpen}
        setIsTakeOverModalOpen={setIsTakeOverModalOpen}
        lockedByOther={lockedByOther}
        takeOver={takeOver}
      />
    </div>
  );
};
