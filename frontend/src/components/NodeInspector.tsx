import React, { useState, useEffect } from 'react';
import type { ParascopeNode } from '../rete';

export interface NodeUpdates {
    label?: string;
    initialData?: Record<string, any>;
    inputs?: { key: string; socket_type: string }[];
    outputs?: { key: string; socket_type: string }[];
}

interface NodeInspectorProps {
  node: ParascopeNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, updates: NodeUpdates) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  isOpen,
  onClose,
  onSave,
}) => {
  const [label, setLabel] = useState('');
  const [data, setData] = useState<Record<string, any>>({});
  const [inputs, setInputs] = useState<{ key: string; socket_type: string }[]>([]);
  const [outputs, setOutputs] = useState<{ key: string; socket_type: string }[]>([]);

  useEffect(() => {
    if (node) {
      setLabel(node.label);
      
      const currentData = { ...(node.initialData || {}) };
      // Sync value from control if it exists, as it might be newer than initialData
      if (node.controls['value']) {
          const control = node.controls['value'] as any;
          // Check if control has a value property (it should for InputControl)
          if (control && control.value !== undefined) {
             // Try to parse as number if it looks like one, since we store value as number in data
             const val = parseFloat(control.value);
             if (!isNaN(val)) {
                 currentData.value = val;
             } else {
                 currentData.value = control.value;
             }
          }
      }

      setData(currentData);
      // We need to extract inputs/outputs from the node structure
      // Rete nodes store inputs/outputs as objects, but we want arrays for editing
      setInputs(Object.keys(node.inputs).map(key => ({ key, socket_type: 'any' })));
      setOutputs(Object.keys(node.outputs).map(key => ({ key, socket_type: 'any' })));
    }
  }, [node]);

  if (!isOpen || !node) return null;

  const handleSave = () => {
    onSave(node.id, {
      label,
      initialData: data,
      inputs,
      outputs,
    });
    onClose();
  };

  const handleAddInput = () => {
    const name = prompt('Input name:');
    if (name) setInputs([...inputs, { key: name, socket_type: 'any' }]);
  };

  const handleRemoveInput = (key: string) => {
    setInputs(inputs.filter(i => i.key !== key));
  };

  const handleAddOutput = () => {
    const name = prompt('Output name:');
    if (name) setOutputs([...outputs, { key: name, socket_type: 'any' }]);
  };

  const handleRemoveOutput = (key: string) => {
    setOutputs(outputs.filter(o => o.key !== key));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Edit Node: {node.type}</h2>
        
        <div className="form-group">
          <label htmlFor="node-label">Label:</label>
          <input 
            id="node-label"
            value={label} 
            onChange={e => setLabel(e.target.value)} 
          />
        </div>

        {node.type === 'parameter' && (
          <div className="form-group">
            <label htmlFor="node-value">Value:</label>
            <input 
              id="node-value"
              type="number"
              value={data.value || 0} 
              onChange={e => setData({ ...data, value: parseFloat(e.target.value) })} 
            />
          </div>
        )}

        {node.type === 'function' && (
          <>
            <div className="form-group">
              <label htmlFor="node-code">Python Code:</label>
              <textarea 
                id="node-code"
                value={data.code || ''} 
                onChange={e => setData({ ...data, code: e.target.value })}
                rows={10}
                style={{ width: '100%', fontFamily: 'monospace' }}
              />
              <small>Use input names as variables. Assign result to output names.</small>
            </div>

            <div className="io-section">
              <div className="io-column">
                <h3>Inputs</h3>
                <ul>
                  {inputs.map(i => (
                    <li key={i.key}>
                      {i.key} 
                      <button type="button" onClick={() => handleRemoveInput(i.key)}>x</button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={handleAddInput}>+ Add Input</button>
              </div>
              
              <div className="io-column">
                <h3>Outputs</h3>
                <ul>
                  {outputs.map(o => (
                    <li key={o.key}>
                      {o.key} 
                      <button type="button" onClick={() => handleRemoveOutput(o.key)}>x</button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={handleAddOutput}>+ Add Output</button>
              </div>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={handleSave} className="primary">Save</button>
        </div>
      </div>
    </div>
  );
};
