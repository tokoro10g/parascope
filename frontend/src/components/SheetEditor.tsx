import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useRete } from 'rete-react-plugin';
import { ClassicPreset as Classic } from 'rete';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft } from 'lucide-react';
import { api, type Sheet } from '../api';
import { createEditor, ParascopeNode, socket } from '../rete';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { EditorBar } from './EditorBar';
import { EvaluatorBar, type EvaluatorInput, type EvaluatorOutput } from './EvaluatorBar';
import { NodeInspector, type NodeUpdates } from './NodeInspector';
import { SheetPickerModal } from './SheetPickerModal';
import { SheetTable } from './SheetTable';

export const SheetEditor: React.FC = () => {
  const { sheetId } = useParams<{ sheetId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ref, editor] = useRete(createEditor);
  const [currentSheet, setCurrentSheet] = useState<Sheet | null>(null);
  const [nodes, setNodes] = useState<ParascopeNode[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastResult, setLastResult] = useState<Record<string, any> | null>(null);
  const [evaluatorInputs, setEvaluatorInputs] = useState<Record<string, string>>({});
  const [editingNode, setEditingNode] = useState<ParascopeNode | null>(null);
  const [errorNodeId, setErrorNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSheetPickerOpen, setIsSheetPickerOpen] = useState(false);
  
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
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        navigate('/');
      }
    } else {
      navigate('/');
    }
  };

  // Load the specific sheet when sheetId changes
  useEffect(() => {
    if (sheetId) {
      handleLoadSheet(sheetId);
    }
  }, [sheetId, editor]); // Depend on editor to ensure it's ready

  // Sync URL Query Params to Evaluator Inputs
  useEffect(() => {
      if (ignoreNextSearchParamsChange.current) {
          ignoreNextSearchParamsChange.current = false;
          return;
      }

      const overrides: Record<string, string> = {};
      searchParams.forEach((value, key) => {
          overrides[key] = value;
      });
      setEvaluatorInputs(overrides);
  }, [searchParams]);

  // Handle Hash Changes for Focus
  useEffect(() => {
      if (editor && location.hash) {
          const nodeId = location.hash.substring(1);
          // Only zoom if the node exists and we are not currently loading (handled by loadSheet)
          // But loadSheet is async.
          // Simple check: if node exists in editor.
          // Note: loadSheet handles the initial hash focus. This is for subsequent changes.
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
      }
  }, [editor, errorNodeId]);

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
          editor.setGraphChangeListener(() => {
              setIsDirty(true);
              setNodes([...editor.editor.getNodes()]);
          });
      }
  }, [editor]);

  const handleLoadSheet = async (id: string) => {
    if (!editor) return;
    try {
      const sheet = await api.getSheet(id);
      setCurrentSheet(sheet);
      setLastResult(null);
      // Note: evaluatorInputs are handled by the useEffect on searchParams
      
      const focusNodeId = location.hash ? location.hash.substring(1) : undefined;
      await editor.loadSheet(sheet, focusNodeId);
      setNodes([...editor.editor.getNodes()]);
      setIsDirty(false);

      // Auto-calculate (UI-27.0)
      const inputNodes = sheet.nodes.filter(n => n.type === 'input');
      const inputsFromParams: Record<string, string> = {};
      searchParams.forEach((value, key) => {
          inputsFromParams[key] = value;
      });

      const allInputsProvided = inputNodes.every(n => n.id && inputsFromParams[n.id]);

      if (inputNodes.length === 0 || allInputsProvided) {
          setIsCalculating(true);
          try {
              const result = await api.calculate(sheet.id, inputsFromParams);
              setLastResult(result);
              editor.updateNodeValues(inputsFromParams, result);
              setNodes([...editor.editor.getNodes()]);
          } catch (e) {
              console.error("Auto-calculation failed", e);
          } finally {
              setIsCalculating(false);
          }
      }
    } catch (e) {
      console.error(e);
      alert(`Error loading sheet: ${e}`);
    }
  };

  const handleSaveSheet = async () => {
    if (!currentSheet || !editor) return;
    try {
        const graphData = editor.getGraphData();
        
        const nodes = graphData.nodes.map(n => ({
            id: n.id,
            type: n.type,
            label: n.label,
            position_x: n.position_x,
            position_y: n.position_y,
            inputs: n.inputs,
            outputs: n.outputs,
            data: n.data
        }));

        const connections = graphData.connections.map(c => ({
            id: c.id,
            source_id: c.source_id,
            target_id: c.target_id,
            source_port: c.source_port,
            target_port: c.target_port
        }));

        const updatedSheet = await api.updateSheet(currentSheet.id, {
            nodes,
            connections
        });
        
        setCurrentSheet(updatedSheet);
        setIsDirty(false);
    } catch (e) {
        console.error(e);
        alert(`Error saving sheet: ${e}`);
    }
  };

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

  const handleAddNode = async (type: 'parameter' | 'function' | 'input' | 'output' | 'sheet') => {
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
          () => setIsDirty(true)
      );
      node.id = id;
      node.dbId = id;

      await editor.editor.addNode(node);
      await editor.area.translate(node.id, { x: 100, y: 100 });

      setEditingNode(node);

      const newNodeData = {
          id,
          type,
          label,
          position_x: 100,
          position_y: 100,
          inputs,
          outputs,
          data
      };

      setCurrentSheet(prev => prev ? ({
          ...prev,
          nodes: [...prev.nodes, newNodeData]
      }) : null);
  };

  const handleImportSheet = async (sheet: Sheet) => {
      setIsSheetPickerOpen(false);
      if (!editor || !currentSheet) return;

      try {
          // Fetch full sheet details to get inputs/outputs
          const fullSheet = await api.getSheet(sheet.id);
          
          const inputs = fullSheet.nodes
            .filter(n => n.type === 'input')
            .map(n => ({ key: n.label, socket_type: 'any' }));
            
          const outputs = fullSheet.nodes
            .filter(n => n.type === 'output')
            .map(n => ({ key: n.label, socket_type: 'any' }));

          const id = uuidv4();
          const type = 'sheet';
          const label = sheet.name;
          const data = { sheetId: sheet.id };

          const node = new ParascopeNode(
              type, 
              label, 
              inputs, 
              outputs, 
              data,
              () => setIsDirty(true)
          );
          node.id = id;
          node.dbId = id;

          await editor.editor.addNode(node);
          await editor.area.translate(node.id, { x: 100, y: 100 });

          setEditingNode(node);

          const newNodeData = {
              id,
              type,
              label,
              position_x: 100,
              position_y: 100,
              inputs,
              outputs,
              data
          };

          setCurrentSheet(prev => prev ? ({
              ...prev,
              nodes: [...prev.nodes, newNodeData]
          }) : null);
      } catch (e) {
          console.error(e);
          alert(`Error importing sheet: ${e}`);
      }
  };

  // Derive Evaluator Props
  const evaluatorProps = useMemo(() => {
      if (!currentSheet) return { inputs: [], outputs: [] };

      const inputs: EvaluatorInput[] = currentSheet.nodes
        .filter(n => n.type === 'input' && n.id)
        .map(n => ({
            id: n.id!,
            label: n.label,
            value: evaluatorInputs[n.id!] !== undefined ? evaluatorInputs[n.id!] : ''
        }));

      const outputs: EvaluatorOutput[] = currentSheet.nodes
        .filter(n => n.type === 'output' && n.id)
        .map(n => ({
            id: n.id!,
            label: n.label,
            value: lastResult ? lastResult[n.id!] : undefined
        }));

      return { inputs, outputs };
  }, [currentSheet, evaluatorInputs, lastResult]);

  useEffect(() => {
      if (editor) {
          const inputValues: Record<string, any> = {};
          evaluatorProps.inputs.forEach(i => {
              inputValues[i.id] = i.value;
          });
          editor.updateNodeValues(inputValues, lastResult || {});
      }
  }, [editor, evaluatorProps, lastResult]);

  const handleCalculate = async () => {
    if (!currentSheet) return;
    setIsCalculating(true);
    try {
      await handleSaveSheet();
      
      const result = await api.calculate(currentSheet.id, evaluatorInputs);
      console.log('Calculation result:', result);
      setLastResult(result);
      if (editor) {
          editor.updateNodeValues(evaluatorInputs, result);
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

  const handleEvaluatorInputChange = (id: string, value: string) => {
      setEvaluatorInputs(prev => ({ ...prev, [id]: value }));
      
      if (errorNodeId === id) {
          setErrorNodeId(null);
      }

      ignoreNextSearchParamsChange.current = true;
      setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          if (value) {
              newParams.set(id, value);
          } else {
              newParams.delete(id);
          }
          return newParams;
      }, { replace: true });
  };

  const handleNodeUpdate = async (nodeId: string, updates: NodeUpdates) => {
      if (!editor) return;
      
      const node = editor.editor.getNode(nodeId);
      if (!node) return;

      if (updates.label) {
          node.label = updates.label;
      }

      if (updates.initialData) {
          node.initialData = { ...node.initialData, ...updates.initialData };
          if (updates.initialData.value !== undefined && node.controls.value) {
              (node.controls.value as any).setValue(String(updates.initialData.value));
          }
      }

      if (updates.inputs) {
          const newKeys = new Set(updates.inputs.map(i => i.key));
          Object.keys(node.inputs).forEach(key => {
              if (!newKeys.has(key)) {
                  node.removeInput(key);
              }
          });
          updates.inputs.forEach(i => {
              if (!node.inputs[i.key]) {
                  node.addInput(i.key, new Classic.Input(socket, i.key));
              }
          });
      }

      if (updates.outputs) {
          const newKeys = new Set(updates.outputs.map(o => o.key));
          Object.keys(node.outputs).forEach(key => {
              if (!newKeys.has(key)) {
                  node.removeOutput(key);
              }
          });
          updates.outputs.forEach(o => {
              if (!node.outputs[o.key]) {
                  node.addOutput(o.key, new Classic.Output(socket, o.key));
              }
          });
      }

      await editor.area.update('node', nodeId);

      setIsDirty(true);

      const graphData = editor.getGraphData();
      setCurrentSheet(prev => prev ? { ...prev, nodes: graphData.nodes } : null);
      setNodes([...editor.editor.getNodes()]);
  };

  const handleUpdateNodeValue = (nodeId: string, value: number) => {
      if (!editor) return;
      const node = editor.editor.getNode(nodeId);
      if (node) {
          const control = node.controls['value'] as any;
          if (control) {
              control.setValue(String(value));
              editor.area.update('node', nodeId);
              setIsDirty(true);
              setNodes([...editor.editor.getNodes()]);
          }
      }
  };

  const handleSelectNode = (nodeId: string) => {
      if (!editor) return;
      editor.zoomToNode(nodeId);
  };

  return (
    <div className="sheet-editor">
      <div className="nav-bar">
          <a href="/" onClick={handleBackClick} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowLeft size={16} /> Back to Dashboard
          </a>
      </div>
      <div className="editor-content" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Group orientation="horizontal" style={{ width: '100%', height: '100%' }}>
          <Panel defaultSize={70} minSize={30}>
            <div className="rete-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
                <EditorBar 
                  sheetName={currentSheet?.name}
                  isDirty={isDirty}
                  onRenameSheet={handleRenameSheet}
                  onSaveSheet={handleSaveSheet}
                  onAddNode={handleAddNode}
                />
                <div ref={ref} className="rete" />
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
          <Separator style={{ width: '4px', background: '#ccc', cursor: 'col-resize' }} />
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
