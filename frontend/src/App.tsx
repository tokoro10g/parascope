import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRete } from 'rete-react-plugin';
import { api, type Sheet, type SheetSummary } from './api';
import { createEditor, ParascopeNode } from './rete';
import { EditorBar } from './components/EditorBar';
import { EvaluatorBar, type EvaluatorInput, type EvaluatorOutput } from './components/EvaluatorBar';
import './App.css';
import './common.css';
import './rete.css';

function App() {
  const [ref, editor] = useRete(createEditor);
  const [currentSheet, setCurrentSheet] = useState<Sheet | null>(null);
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastResult, setLastResult] = useState<Record<string, any> | null>(null);
  const [evaluatorInputs, setEvaluatorInputs] = useState<Record<string, string>>({});

  const loadSheetList = useCallback(async () => {
    try {
      const list = await api.listSheets();
      setSheets(list);
    } catch (e) {
      console.error('Failed to load sheets', e);
    }
  }, []);

  useEffect(() => {
    loadSheetList();
  }, [loadSheetList]);

  const handleLoadSheet = async (id: string) => {
    try {
      const sheet = await api.getSheet(id);
      setCurrentSheet(sheet);
      setLastResult(null);
      setEvaluatorInputs({}); // Reset evaluator inputs
      if (editor) {
        await editor.loadSheet(sheet);
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
    } catch (e) {
        console.error(e);
        alert(`Error saving sheet: ${e}`);
    }
  };

  const handleCreateSheet = async () => {
    try {
      const sheet = await api.createSheet(`Untitled Sheet ${Date.now()}`);
      setCurrentSheet(sheet);
      if (editor) {
        await editor.loadSheet(sheet);
      }
      await loadSheetList();
    } catch (e) {
      console.error(e);
      alert(`Error creating sheet: ${e}`);
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
              data = {}; // Input nodes don't have a static value
              break;
          case 'output':
              label = 'Output';
              inputs = [{ key: 'value', socket_type: 'any' }];
              break;
      }

      // Add to editor directly to preserve state
      const node = new ParascopeNode(type, label, inputs, outputs, data);
      node.id = id;
      node.dbId = id;

      await editor.editor.addNode(node);
      
      // Position the node (offset slightly to be visible)
      // Ideally we'd use the center of the view, but for now fixed position is fine
      await editor.area.translate(node.id, { x: 100, y: 100 });

      // Update React State (currentSheet) so EvaluatorBar updates
      // We don't reload the sheet in the editor
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

  const handleCalculate = async () => {
    if (!currentSheet) return;
    setIsCalculating(true);
    try {
      // First save? Maybe not required for experimentation (UI-02.0)
      // But backend needs the graph structure.
      // If we want to support "experimentation without saving", we need to send the graph structure to calculate endpoint
      // OR we save implicitly.
      // For now, let's save implicitly to ensure backend has the graph.
      await handleSaveSheet();
      
      const result = await api.calculate(currentSheet.id, evaluatorInputs);
      console.log('Calculation result:', result);
      setLastResult(result);
    } catch (e) {
      console.error(e);
      alert(`Error calculating: ${e}`);
    } finally {
        setIsCalculating(false);
    }
  };

  // Derive Evaluator Props
  const evaluatorProps = useMemo(() => {
      if (!currentSheet) return { inputs: [], outputs: [] };

      const inputs: EvaluatorInput[] = currentSheet.nodes
        .filter(n => n.type === 'input')
        .map(n => ({
            id: n.id,
            label: n.label,
            value: evaluatorInputs[n.id] !== undefined ? evaluatorInputs[n.id] : (n.data.value || '')
        }));

      const outputs: EvaluatorOutput[] = currentSheet.nodes
        .filter(n => n.type === 'output')
        .map(n => ({
            id: n.id,
            label: n.label,
            value: lastResult ? lastResult[n.id] : undefined
        }));

      return { inputs, outputs };
  }, [currentSheet, evaluatorInputs, lastResult]);

  const handleEvaluatorInputChange = (id: string, value: string) => {
      setEvaluatorInputs(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="App">
      <EditorBar 
        sheets={sheets}
        currentSheetId={currentSheet?.id}
        onLoadSheet={handleLoadSheet}
        onSaveSheet={handleSaveSheet}
        onCreateSheet={handleCreateSheet}
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
    </div>
  );
}

export default App;
