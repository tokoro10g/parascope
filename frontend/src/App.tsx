import { useState } from 'react';
import { useRete } from 'rete-react-plugin';
import { api, type Sheet } from './api';
import { createEditor } from './rete';
import './App.css';
import './common.css';
import './rete.css';

function App() {
  const [ref, editor] = useRete(createEditor);
  const [currentSheet, setCurrentSheet] = useState<Sheet | null>(null);

  const handleCreateSheet = async () => {
    try {
      // Create a sheet with some initial nodes for testing
      const sheet = await api.createSheet(`Test Sheet ${Date.now()}`);

      // Add some nodes via API (simulated by updating the sheet)
      const nodes = [
        {
          id: crypto.randomUUID(),
          type: 'parameter',
          label: 'Mass',
          inputs: [],
          outputs: [{ key: 'value', socket_type: 'number' }],
          position_x: 0,
          position_y: 0,
          data: { value: 10 },
        },
        {
          id: crypto.randomUUID(),
          type: 'parameter',
          label: 'Acceleration',
          inputs: [],
          outputs: [{ key: 'value', socket_type: 'number' }],
          position_x: 0,
          position_y: 200,
          data: { value: 9.8 },
        },
        {
          id: crypto.randomUUID(),
          type: 'function',
          label: 'Force Calculation',
          inputs: [
            { key: 'm', socket_type: 'number' },
            { key: 'a', socket_type: 'number' },
          ],
          outputs: [{ key: 'result', socket_type: 'number' }],
          position_x: 400,
          position_y: 100,
          data: { code: 'result = m * a' },
        },
      ];

      const connections = [
        {
          id: crypto.randomUUID(),
          source_id: nodes[0].id,
          target_id: nodes[2].id,
          source_port: 'value',
          target_port: 'm',
        },
        {
          id: crypto.randomUUID(),
          source_id: nodes[1].id,
          target_id: nodes[2].id,
          source_port: 'value',
          target_port: 'a',
        },
      ];

      const updatedSheet = await api.updateSheet(sheet.id, {
        nodes,
        connections,
      });

      setCurrentSheet(updatedSheet);
      if (editor) {
        await editor.loadSheet(updatedSheet);
      }
    } catch (e) {
      console.error(e);
      alert(`Error creating sheet: ${e}`);
    }
  };

  const handleCalculate = async () => {
    if (!currentSheet) return;
    try {
      const result = await api.calculate(currentSheet.id);
      console.log('Calculation result:', result);
      alert(`Calculation Result: ${JSON.stringify(result, null, 2)}`);
    } catch (e) {
      console.error(e);
      alert(`Error calculating: ${e}`);
    }
  };

  return (
    <div className="App">
      <div
        className="toolbar"
        style={{
          padding: '10px',
          background: '#333',
          color: 'white',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
        }}
      >
        <button type="button" onClick={handleCreateSheet}>
          Create & Load Test Sheet
        </button>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={!currentSheet}
        >
          Calculate
        </button>
        {currentSheet && <span>Current Sheet: {currentSheet.name}</span>}
      </div>
      <div
        ref={ref}
        className="rete"
        style={{ height: '80vh', width: '100%' }}
      />
    </div>
  );
}

export default App;
