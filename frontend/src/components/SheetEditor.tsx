import { ArrowLeft, LogOut } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ClassicPreset as Classic } from 'rete';
import { useRete } from 'rete-react-plugin';
import { v4 as uuidv4 } from 'uuid';
import { api, type NodeResult, type Sheet } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { createEditor, ParascopeNode, socket } from '../rete';
import { EditorBar } from './EditorBar';

const extractValuesFromResult = (
  result: Record<string, NodeResult>,
): Record<string, any> => {
  const values: Record<string, any> = {};
  Object.entries(result).forEach(([id, nodeRes]) => {
    if (nodeRes.value !== undefined) {
      values[id] = nodeRes.value;
    }
  });
  return values;
};

import {
  EvaluatorBar,
  type EvaluatorInput,
  type EvaluatorOutput,
} from './EvaluatorBar';
import { NodeInspector, type NodeUpdates } from './NodeInspector';
import { ParascopeLogo } from './ParascopeLogo';
import { SheetPickerModal } from './SheetPickerModal';
import { SheetTable } from './SheetTable';

export const SheetEditor: React.FC = () => {
  const { sheetId } = useParams<{ sheetId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ref, editor] = useRete(createEditor);
  const [currentSheet, setCurrentSheet] = useState<Sheet | null>(null);
  const [nodes, setNodes] = useState<ParascopeNode[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastResult, setLastResult] = useState<Record<
    string,
    NodeResult
  > | null>(null);
  const [evaluatorInputs, setEvaluatorInputs] = useState<
    Record<string, string>
  >({});
  const [editingNode, setEditingNode] = useState<ParascopeNode | null>(null);
  const [errorNodeId, setErrorNodeId] = useState<string | null>(null);
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

  const handleLoadSheet = useCallback(
    async (id: string) => {
      if (!editor) return;
      setIsLoading(true);
      try {
        const sheet = await api.getSheet(id);

        // --- SYNC NESTED SHEETS ---
        const nestedSheetNodes = sheet.nodes.filter(
          (n) => n.type === 'sheet' && n.data?.sheetId,
        );
        if (nestedSheetNodes.length > 0) {
          const updatedNodes = [...sheet.nodes];
          let connectionsChanged = false;
          const validConnectionIds = new Set(
            sheet.connections.map((c) => c.id),
          );

          await Promise.all(
            nestedSheetNodes.map(async (node) => {
              try {
                const childSheet = await api.getSheet(node.data.sheetId);

                // Update Inputs (from child's Input nodes)
                const newInputs = childSheet.nodes
                  .filter((n) => n.type === 'input')
                  .map((n) => ({ key: n.label, socket_type: 'any' }));

                // Update Outputs (from child's Output nodes)
                const newOutputs = childSheet.nodes
                  .filter((n) => n.type === 'output')
                  .map((n) => ({ key: n.label, socket_type: 'any' }));

                // Find the node in the array and update it
                const nodeIndex = updatedNodes.findIndex(
                  (n) => n.id === node.id,
                );
                if (nodeIndex !== -1) {
                  updatedNodes[nodeIndex] = {
                    ...updatedNodes[nodeIndex],
                    inputs: newInputs,
                    outputs: newOutputs,
                  };
                }

                // Validate Connections
                // Remove connections to/from this node that reference non-existent sockets
                const inputKeys = new Set(newInputs.map((i) => i.key));
                const outputKeys = new Set(newOutputs.map((o) => o.key));

                sheet.connections.forEach((c) => {
                  if (c.target_id === node.id) {
                    if (!inputKeys.has(c.target_port)) {
                      validConnectionIds.delete(c.id);
                      connectionsChanged = true;
                    }
                  }
                  if (c.source_id === node.id) {
                    if (!outputKeys.has(c.source_port)) {
                      validConnectionIds.delete(c.id);
                      connectionsChanged = true;
                    }
                  }
                });
              } catch (err) {
                console.error(
                  `Failed to sync nested sheet ${node.data.sheetId}`,
                  err,
                );
              }
            }),
          );

          sheet.nodes = updatedNodes;
          if (connectionsChanged) {
            sheet.connections = sheet.connections.filter((c) =>
              validConnectionIds.has(c.id),
            );
            console.warn(
              'Removed invalid connections due to nested sheet updates',
            );
            alert(
              'Some connections were removed because the inputs/outputs of nested sheets have changed.',
            );
          }
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
          setIsCalculating(true);
          try {
            const apiInputs: Record<string, { value: any }> = {};
            Object.entries(inputsFromParams).forEach(([id, value]) => {
              const node = inputNodes.find((n) => n.id === id);
              if (node) {
                apiInputs[node.label] = { value };
              }
            });

            const result = await api.calculate(sheet.id, apiInputs);
            setLastResult(result);
            editor.updateNodeValues(
              inputsFromParams,
              extractValuesFromResult(result),
            );
            setNodes([...editor.editor.getNodes()]);
          } catch (e) {
            console.error('Auto-calculation failed', e);
          } finally {
            setIsCalculating(false);
          }
        }
      } catch (e) {
        console.error(e);
        alert(`Error loading sheet: ${e}`);
      }
    },
    [editor],
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
    if (editor && errorNodeId) {
      const view = editor.area.nodeViews.get(errorNodeId);
      if (view) {
        view.element.classList.add('node-error');
      }
    }
    // Cleanup
    return () => {
      if (editor && errorNodeId) {
        const view = editor.area.nodeViews.get(errorNodeId);
        if (view) {
          view.element.classList.remove('node-error');
        }
      }
    };
  }, [editor, errorNodeId]);

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

      const node = nodes.find((n) => n.id === id);
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
    [errorNodeId, setSearchParams, nodes],
  );

  const calcCenterPosition = useCallback(() => {
    if (!editor) return { x: 0, y: 0 };
    const area = editor.area;
    const bounds = area.container.getBoundingClientRect();
    const zoom = area.area.transform.k;
    const x = (bounds.width / 2 - area.area.transform.x) / zoom;
    const y = (bounds.height / 2 - area.area.transform.y) / zoom;
    return { x: x, y: y };
  }, [editor]);

  const handleDuplicateNode = useCallback(
    async (nodeId: string) => {
      if (!editor || !currentSheet) return;
      const originalNode = editor.editor.getNode(nodeId);
      if (!originalNode) return;

      const id = uuidv4();
      const type = originalNode.type;
      const label = `${originalNode.label} (copy)`;

      const inputs = Object.keys(originalNode.inputs).map((key) => ({
        key,
        socket_type: 'any',
      }));
      const outputs = Object.keys(originalNode.outputs).map((key) => ({
        key,
        socket_type: 'any',
      }));

      const data = JSON.parse(JSON.stringify(originalNode.initialData));

      if (originalNode.controls.value) {
        const control = originalNode.controls.value as any;
        if (control && control.value !== undefined) {
          data.value = control.value;
        }
      }

      const node = new ParascopeNode(
        type,
        label,
        inputs,
        outputs,
        data,
        (val) => {
          if (type === 'input') {
            handleEvaluatorInputChange(id, String(val));
          } else {
            setIsDirty(true);
          }
        },
      );
      node.id = id;
      node.dbId = id;

      await editor.editor.addNode(node);

      const originalView = editor.area.nodeViews.get(nodeId);
      const position = originalView
        ? { x: originalView.position.x + 50, y: originalView.position.y + 50 }
        : calcCenterPosition();

      await editor.area.translate(node.id, position);

      const newNodeData = {
        id,
        type,
        label,
        position_x: position.x,
        position_y: position.y,
        inputs,
        outputs,
        data,
      };

      setCurrentSheet((prev) =>
        prev
          ? {
              ...prev,
              nodes: [...prev.nodes, newNodeData],
            }
          : null,
      );

      setIsDirty(true);
      setNodes([...editor.editor.getNodes()]);
    },
    [editor, currentSheet, handleEvaluatorInputChange, calcCenterPosition],
  );

  const handleNodeUpdate = useCallback(
    (nodeId: string, updates: NodeUpdates) => {
      if (!editor) return;

      const node = editor.editor.getNode(nodeId);
      if (!node) return;

      if (updates.label && updates.label !== node.label) {
        // Check for duplicate input/output names
        if (node.type === 'input' || node.type === 'output') {
          const existingNode = nodes.find(
            (n) =>
              n.type === node.type &&
              n.label === updates.label &&
              n.id !== nodeId,
          );
          if (existingNode) {
            alert(
              `An ${node.type} node with the name "${updates.label}" already exists.`,
            );
            return;
          }
        }

        if (node.type === 'input' || node.type === 'output') {
          const isDefaultLabel =
            (node.type === 'input' && node.label === 'Input') ||
            (node.type === 'output' && node.label === 'Output');

          if (!isDefaultLabel) {
            if (
              !window.confirm(
                `Renaming this ${node.type} node may break sheets that use this sheet as a function. Are you sure?`,
              )
            ) {
              return;
            }
          }
        }
        node.label = updates.label;
      }

      if (updates.type && updates.type !== node.type) {
        const existingNode = nodes.find(
          (n) =>
            n.type === updates.type &&
            n.label === node.label &&
            n.id !== nodeId,
        );
        if (existingNode) {
          alert(
            `An ${updates.type} node with the name "${node.label}" already exists.`,
          );
          return;
        }
        if (node.type === 'input') {
          // An input node is going to be switched to a parameter node. Warn the user.
          if (
            !window.confirm(
              `Switching this ${node.type} node to ${updates.type} node may break sheets that use this sheet as a function. Are you sure?`,
            )
          ) {
            return;
          }
        }
        node.type = updates.type;
        node.setupControl();
      }

      if (updates.initialData) {
        node.initialData = { ...node.initialData, ...updates.initialData };
        node.setupControl();
      }

      if (updates.inputs) {
        const newKeys = new Set(updates.inputs.map((i) => i.key));
        Object.keys(node.inputs).forEach((key) => {
          if (!newKeys.has(key)) {
            node.removeInput(key);
          }
        });
        updates.inputs.forEach((i) => {
          if (!node.inputs[i.key]) {
            node.addInput(i.key, new Classic.Input(socket, i.key));
          }
        });
        // Reorder inputs to match updates.inputs order
        const orderedInputs: typeof node.inputs = {};
        updates.inputs.forEach((i) => {
          if (node.inputs[i.key]) {
            orderedInputs[i.key] = node.inputs[i.key]!;
          }
        });
        node.inputs = orderedInputs;
      }

      if (updates.outputs) {
        const newKeys = new Set(updates.outputs.map((o) => o.key));
        Object.keys(node.outputs).forEach((key) => {
          if (!newKeys.has(key)) {
            node.removeOutput(key);
          }
        });
        updates.outputs.forEach((o) => {
          if (!node.outputs[o.key]) {
            node.addOutput(o.key, new Classic.Output(socket, o.key));
          }
        });
        // Reorder outputs to match updates.outputs order
        const orderedOutputs: typeof node.outputs = {};
        updates.outputs.forEach((o) => {
          if (node.outputs[o.key]) {
            orderedOutputs[o.key] = node.outputs[o.key]!;
          }
        });
        node.outputs = orderedOutputs;
      }

      editor.area.update('node', nodeId);

      setIsDirty(true);

      const graphData = editor.getGraphData();
      setCurrentSheet((prev) =>
        prev ? { ...prev, nodes: graphData.nodes } : null,
      );
      setNodes([...editor.editor.getNodes()]);
    },
    [editor, nodes],
  );

  useEffect(() => {
    if (editor) {
      const handleEdit = (nodeId: string) => {
        const node = editor.editor.getNode(nodeId);
        if (node) {
          setEditingNode(node);
        }
      };
      editor.setNodeDoubleClickListener(handleEdit);
      editor.setNodeEditListener(handleEdit);
      editor.setNodeDuplicateListener(handleDuplicateNode);
      editor.setNodeTypeChangeListener((nodeId, type) => {
        handleNodeUpdate(nodeId, { type });
      });
      editor.setNodeRemoveListener(async (nodeId) => {
        const node = editor.editor.getNode(nodeId);
        if (node && (node.type === 'input' || node.type === 'output')) {
          return window.confirm(
            `Deleting this ${node.type} node may break sheets that use this sheet as a function. Are you sure?`,
          );
        }
        return true;
      });
      editor.setEditNestedSheetListener((nodeId) => {
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

    const id = uuidv4();
    let label: string = type;
    let inputs: { key: string; socket_type: string }[] = [];
    let outputs: { key: string; socket_type: string }[] = [];
    let data: Record<string, any> = {};

    switch (type) {
      case 'parameter':
        label = 'Parameter';
        outputs = [{ key: 'value', socket_type: 'any' }];
        data = { value: 0 };
        break;
      case 'function':
        label = 'Function';
        inputs = [{ key: 'x', socket_type: 'any' }];
        outputs = [{ key: 'result', socket_type: 'any' }];
        data = { code: 'result = x' };
        break;
      case 'input':
        label = 'Input';
        outputs = [{ key: 'value', socket_type: 'any' }];
        data = {};
        break;
      case 'output':
        label = 'Output';
        inputs = [{ key: 'value', socket_type: 'any' }];
        break;
    }

    const node = new ParascopeNode(
      type,
      label,
      inputs,
      outputs,
      data,
      (val) => {
        if (type === 'input') {
          handleEvaluatorInputChange(id, String(val));
        } else {
          setIsDirty(true);
        }
      },
    );
    node.id = id;
    node.dbId = id;

    await editor.editor.addNode(node);
    const centerPos = calcCenterPosition();
    await editor.area.translate(node.id, centerPos);

    setEditingNode(node);

    const newNodeData = {
      id,
      type,
      label,
      position_x: centerPos.x,
      position_y: centerPos.y,
      inputs,
      outputs,
      data,
    };

    setCurrentSheet((prev) =>
      prev
        ? {
            ...prev,
            nodes: [...prev.nodes, newNodeData],
          }
        : null,
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
        .map((n) => ({ key: n.label, socket_type: 'any' }));

      const outputs = fullSheet.nodes
        .filter((n) => n.type === 'output')
        .map((n) => ({ key: n.label, socket_type: 'any' }));

      const id = uuidv4();
      const type = 'sheet';
      const label = sheet.name;
      const data = { sheetId: sheet.id };

      const node = new ParascopeNode(type, label, inputs, outputs, data, () =>
        setIsDirty(true),
      );
      node.id = id;
      node.dbId = id;

      await editor.editor.addNode(node);
      const centerPos = calcCenterPosition();
      await editor.area.translate(node.id, centerPos);

      const newNodeData = {
        id,
        type,
        label,
        position_x: centerPos.x,
        position_y: centerPos.y,
        inputs,
        outputs,
        data,
      };

      setCurrentSheet((prev) =>
        prev
          ? {
              ...prev,
              nodes: [...prev.nodes, newNodeData],
            }
          : null,
      );
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

    const outputs: EvaluatorOutput[] = sortedNodes
      .filter((n) => n.type === 'output' && n.id)
      .map((n) => ({
        id: n.id!,
        label: n.label,
        value: lastResult ? lastResult[n.id!]?.value : undefined,
      }));

    return { inputs, outputs };
  }, [currentSheet, nodes, evaluatorInputs, lastResult]);

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
    setIsCalculating(true);
    try {
      await handleSaveSheet();

      const apiInputs: Record<string, { value: any }> = {};
      Object.entries(evaluatorInputs).forEach(([id, value]) => {
        const node = nodes.find((n) => n.id === id);
        if (node) {
          apiInputs[node.label] = { value };
        }
      });

      const result = await api.calculate(currentSheet.id, apiInputs);
      console.log('Calculation result:', result);
      setLastResult(result);
      if (editor) {
        editor.updateNodeValues(
          evaluatorInputs,
          extractValuesFromResult(result),
        );
        setNodes([...editor.editor.getNodes()]);
      }
      setErrorNodeId(null);
    } catch (e: any) {
      console.error(e);
      if (e.nodeId) {
        setErrorNodeId(e.nodeId);
      }
      alert(`Error calculating: ${e.message}`);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleUpdateNodeValue = (nodeId: string, value: string) => {
    if (!editor) return;
    const node = editor.editor.getNode(nodeId);
    if (node) {
      const control = node.controls.value as any;
      if (control) {
        control.setValue(value);
        editor.area.update('node', nodeId);
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
      <div
        className="nav-bar"
        style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
      >
        <ParascopeLogo size={16} />
        <span style={{ fontWeight: 'bold' }}>Parascope</span>
        <button
          type="button"
          onClick={handleBackClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            font: 'inherit',
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingRight: '10px',
          }}
        >
          <span style={{ fontSize: '0.9em', color: 'white' }}>{user}</span>
          <button
            type="button"
            onClick={logout}
            title="Change User"
            className="nav-link"
          >
            <LogOut size={16} /> Change User
          </button>
        </div>
      </div>
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
              <EvaluatorBar
                sheetName={currentSheet?.name}
                inputs={evaluatorProps.inputs}
                outputs={evaluatorProps.outputs}
                onInputChange={handleEvaluatorInputChange}
                onCalculate={handleCalculate}
                isCalculating={isCalculating}
                errorNodeId={errorNodeId}
              />
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
