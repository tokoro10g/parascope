import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useRete } from 'rete-react-plugin';
import { ClassicPreset as Classic } from 'rete';
import { api, type Sheet } from '../api';
import { createEditor, ParascopeNode, socket } from '../rete';
import { EditorBar } from './EditorBar';
import { EvaluatorBar, type EvaluatorInput, type EvaluatorOutput } from './EvaluatorBar';
import { NodeInspector, type NodeUpdates } from './NodeInspector';

export const SheetEditor: React.FC = () => {
  const { sheetId } = useParams<{ sheetId: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ref, editor] = useRete(createEditor);
  const [currentSheet, setCurrentSheet] = useState<Sheet | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastResult, setLastResult] = useState<Record<string, any> | null>(null);
  const [evaluatorInputs, setEvaluatorInputs] = useState<Record<string, string>>({});
  const [editingNode, setEditingNode] = useState<ParascopeNode | null>(null);
  const [errorNodeId, setErrorNodeId] = useState<string | null>(null);
  
  const ignoreNextSearchParamsChange = useRef(false);

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
          editor.setNodeDoubleClickListener((nodeId) => {
              const node = editor.editor.getNode(nodeId);
              if (node) {
                  setEditingNode(node);
              }
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
      } catch (e) {
          console.error(e);
          alert(`Error renaming sheet: ${e}`);
      }
  };

  const handleAddNode = async (type: 'parameter' | 'function' | 'input' | 'output') => {
      if (!editor || !currentSheet) return;

      const id = crypto.randomUUID();
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

      const node = new ParascopeNode(type, label, inputs, outputs, data);
      node.id = id;
      node.dbId = id;

      await editor.editor.addNode(node);
      await editor.area.translate(node.id, { x: 100, y: 100 });

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

      const graphData = editor.getGraphData();
      setCurrentSheet(prev => prev ? { ...prev, nodes: graphData.nodes } : null);
  };

  return (
    <div className="sheet-editor">
      <div className="nav-bar">
          <Link to="/">← Back to Dashboard</Link>
      </div>
      <EditorBar 
        sheetName={currentSheet?.name}
        onRenameSheet={handleRenameSheet}
        onSaveSheet={handleSaveSheet}
        onAddNode={handleAddNode}
      />
      <EvaluatorBar 
        sheetName={currentSheet?.name}
        inputs={evaluatorProps.inputs}
        outputs={evaluatorProps.outputs}
        onInputChange={handleEvaluatorInputChange}
        onCalculate={handleCalculate}
        isCalculating={isCalculating}
      />
      <div ref={ref} className="rete" />
      <NodeInspector 
        node={editingNode}
        isOpen={!!editingNode}
        onClose={() => setEditingNode(null)}
        onSave={handleNodeUpdate}
      />
    </div>
  );
};
