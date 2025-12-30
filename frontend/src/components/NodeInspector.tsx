import CodeEditor from '@uiw/react-textarea-code-editor';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { API_BASE, getAttachmentUrl, uploadAttachment } from '../api';
import type { ParascopeNode } from '../rete';

export interface NodeUpdates {
  type?: string;
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
  const [inputs, setInputs] = useState<{ key: string; socket_type: string }[]>(
    [],
  );
  const [outputs, setOutputs] = useState<
    { key: string; socket_type: string }[]
  >([]);
  const [showPreview, setShowPreview] = useState(false);

  const isValidPythonIdentifier = (name: string) => {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  };

  useEffect(() => {
    if (node) {
      setLabel(node.label);

      const currentData = { ...(node.initialData || {}) };

      // Initialize defaults for new fields
      if (!currentData.dataType) currentData.dataType = 'number';
      if (!currentData.options) currentData.options = [];

      // Sync value from control if it exists, as it might be newer than initialData
      if (node.controls.value) {
        const control = node.controls.value as any;
        // Check if control has a value property (it should for InputControl)
        if (control && control.value !== undefined) {
          // Try to parse as number if it looks like one, since we store value as number in data
          // Only parse as float if dataType is number (or not set, assuming number)
          if (currentData.dataType === 'number') {
            const val = parseFloat(control.value);
            if (!Number.isNaN(val)) {
              currentData.value = val;
            } else {
              currentData.value = control.value;
            }
          } else {
            currentData.value = control.value;
          }
        }
      }

      setData(currentData);
      // We need to extract inputs/outputs from the node structure
      // Rete nodes store inputs/outputs as objects, but we want arrays for editing
      setInputs(
        Object.keys(node.inputs).map((key) => ({ key, socket_type: 'any' })),
      );
      setOutputs(
        Object.keys(node.outputs).map((key) => ({ key, socket_type: 'any' })),
      );
    }
  }, [node]);

  if (!isOpen || !node) return null;

  const transformUrl = (url: string) => {
    if (url.startsWith('/attachments/')) {
      return `${API_BASE}${url}`;
    }
    return url;
  };

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
    let name = 'input';
    let counter = 1;
    while (inputs.some((i) => i.key === name)) {
      name = `input_${counter}`;
      counter++;
    }
    setInputs([...inputs, { key: name, socket_type: 'any' }]);
  };

  const handleRemoveInput = (index: number) => {
    const newInputs = [...inputs];
    newInputs.splice(index, 1);
    setInputs(newInputs);
  };

  const handleInputNameChange = (index: number, newName: string) => {
    const newInputs = [...inputs];
    newInputs[index].key = newName;
    setInputs(newInputs);
  };

  const handleMoveInput = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newInputs = [...inputs];
      [newInputs[index], newInputs[index - 1]] = [
        newInputs[index - 1],
        newInputs[index],
      ];
      setInputs(newInputs);
    } else if (direction === 'down' && index < inputs.length - 1) {
      const newInputs = [...inputs];
      [newInputs[index], newInputs[index + 1]] = [
        newInputs[index + 1],
        newInputs[index],
      ];
      setInputs(newInputs);
    }
  };

  const handleAddOutput = () => {
    let name = 'output';
    let counter = 1;
    while (outputs.some((o) => o.key === name)) {
      name = `output_${counter}`;
      counter++;
    }
    setOutputs([...outputs, { key: name, socket_type: 'any' }]);
  };

  const handleRemoveOutput = (index: number) => {
    const newOutputs = [...outputs];
    newOutputs.splice(index, 1);
    setOutputs(newOutputs);
  };

  const handleOutputNameChange = (index: number, newName: string) => {
    const newOutputs = [...outputs];
    newOutputs[index].key = newName;
    setOutputs(newOutputs);
  };

  const handleMoveOutput = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newOutputs = [...outputs];
      [newOutputs[index], newOutputs[index - 1]] = [
        newOutputs[index - 1],
        newOutputs[index],
      ];
      setOutputs(newOutputs);
    } else if (direction === 'down' && index < outputs.length - 1) {
      const newOutputs = [...outputs];
      [newOutputs[index], newOutputs[index + 1]] = [
        newOutputs[index + 1],
        newOutputs[index],
      ];
      setOutputs(newOutputs);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      try {
        const result = await uploadAttachment(e.target.files[0]);
        setData({ ...data, attachment: result.filename });
      } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload attachment');
      }
    }
  };

  const handleRemoveAttachment = () => {
    const newData = { ...data };
    delete newData.attachment;
    setData(newData);
  };

  const handleInsertToDescription = () => {
    if (!data.attachment) return;
    const url = getAttachmentUrl(data.attachment);
    const markdownImage = `![Attachment](${url})`;

    setData((prev) => ({
      ...prev,
      description: prev.description
        ? `${prev.description}\n\n${markdownImage}`
        : markdownImage,
    }));
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
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {node.type !== 'sheet' && (
          <>
            <div className="form-group">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '5px',
                }}
              >
                <label htmlFor="node-description" style={{ marginBottom: 0 }}>
                  Description (Markdown):
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  style={{
                    fontSize: '0.8em',
                    padding: '2px 8px',
                    cursor: 'pointer',
                  }}
                >
                  {showPreview ? 'Edit' : 'Preview'}
                </button>
              </div>

              {showPreview ? (
                <div
                  className="markdown-preview"
                  style={{
                    border: '1px solid var(--border-color)',
                    padding: '10px',
                    minHeight: '100px',
                    borderRadius: '4px',
                    background: 'var(--input-bg)',
                    color: 'var(--text-color)',
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    urlTransform={transformUrl}
                  >
                    {data.description || '*No description*'}
                  </ReactMarkdown>
                </div>
              ) : (
                <div style={{ overflow: 'auto' }}>
                  <CodeEditor
                    id="node-description"
                    value={data.description || ''}
                    language="md"
                    placeholder="Enter description here..."
                    onChange={(e: any) =>
                      setData({ ...data, description: e.target.value })
                    }
                    padding={15}
                    indentWidth={2}
                    style={{ minWidth: 'max-content', fontFamily: 'monospace' }}
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <div
                style={{
                  display: 'block',
                  marginBottom: '5px',
                  fontWeight: 'bold',
                }}
              >
                Attachment:
              </div>
              {data.attachment ? (
                <div
                  className="attachment-preview"
                  style={{ marginTop: '5px' }}
                >
                  <img
                    src={getAttachmentUrl(data.attachment)}
                    alt="Attachment"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '200px',
                      display: 'block',
                      marginBottom: '10px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <a
                      href={getAttachmentUrl(data.attachment)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--link-color, #007bff)' }}
                    >
                      Open Original
                    </a>
                    <button type="button" onClick={handleInsertToDescription}>
                      Insert into Description
                    </button>
                    <button type="button" onClick={handleRemoveAttachment}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <input type="file" onChange={handleFileUpload} />
              )}
            </div>
          </>
        )}

        {(node.type === 'parameter' ||
          node.type === 'input' ||
          node.type === 'output') && (
          <>
            <div className="form-group">
              <label htmlFor="node-type">Type:</label>
              <select
                id="node-type"
                value={data.dataType || 'number'}
                onChange={(e) => setData({ ...data, dataType: e.target.value })}
                style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
              >
                <option value="number">Number</option>
                <option value="option">Option (Enum)</option>
              </select>
            </div>

            {(data.dataType === 'number' || !data.dataType) && (
              <div className="form-group">
                <label
                  htmlFor="node-min"
                  style={{ display: 'block', marginBottom: '5px' }}
                >
                  Range Validation:
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label
                      htmlFor="node-min"
                      style={{ fontSize: '0.8em', display: 'block' }}
                    >
                      Min
                    </label>
                    <input
                      id="node-min"
                      type="number"
                      value={data.min !== undefined ? data.min : ''}
                      onChange={(e) =>
                        setData({ ...data, min: e.target.value })
                      }
                      placeholder="-∞"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label
                      htmlFor="node-max"
                      style={{ fontSize: '0.8em', display: 'block' }}
                    >
                      Max
                    </label>
                    <input
                      id="node-max"
                      type="number"
                      value={data.max !== undefined ? data.max : ''}
                      onChange={(e) =>
                        setData({ ...data, max: e.target.value })
                      }
                      placeholder="+∞"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {data.dataType === 'option' && (
              <div className="form-group">
                <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>
                  Options:
                </div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {(data.options || []).map((opt: string, idx: number) => (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: Options are primitive strings
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: '5px',
                        marginBottom: '5px',
                      }}
                    >
                      <input
                        value={opt}
                        onChange={(e) => {
                          const newOptions = [...(data.options || [])];
                          newOptions[idx] = e.target.value;
                          setData({ ...data, options: newOptions });
                        }}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="danger"
                        style={{ padding: '2px' }}
                        onClick={() => {
                          const newOptions = (data.options || []).filter(
                            (_: any, i: number) => i !== idx,
                          );
                          setData({ ...data, options: newOptions });
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() =>
                    setData({
                      ...data,
                      options: [...(data.options || []), 'New Option'],
                    })
                  }
                >
                  + Add Option
                </button>
              </div>
            )}

            {node.type === 'parameter' && (
              <div className="form-group">
                <label htmlFor="node-value">Value:</label>
                {data.dataType === 'option' ? (
                  <select
                    id="node-value"
                    value={data.value || ''}
                    onChange={(e) =>
                      setData({ ...data, value: e.target.value })
                    }
                    style={{ width: '100%', padding: '8px' }}
                  >
                    <option value="">Select an option...</option>
                    {(data.options || []).map((opt: string) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="node-value"
                    value={data.value || 0}
                    onChange={(e) =>
                      setData({ ...data, value: e.target.value })
                    }
                  />
                )}
              </div>
            )}
          </>
        )}

        {node.type === 'function' && (
          <>
            <div className="form-group">
              <label htmlFor="node-code">Python Code:</label>
              <div style={{ overflow: 'auto' }}>
                <CodeEditor
                  id="node-code"
                  value={data.code || ''}
                  language="py"
                  placeholder="result = x + 1"
                  onChange={(e: any) =>
                    setData({ ...data, code: e.target.value })
                  }
                  padding={15}
                  rows={30}
                  indentWidth={4}
                  style={{ minWidth: 'max-content', fontFamily: 'monospace' }}
                />
              </div>
              <small>
                Use input names as variables. Assign result to output names.
              </small>
            </div>

            <div className="io-section">
              <div className="io-column">
                <h3>Inputs</h3>
                <ul style={{ padding: 0 }}>
                  {inputs.map((i, idx) => (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: Order matters here
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: '5px',
                        marginBottom: '5px',
                        alignItems: 'center',
                      }}
                    >
                      <input
                        value={i.key}
                        onChange={(e) =>
                          handleInputNameChange(idx, e.target.value)
                        }
                        style={{
                          flex: 1,
                          fontFamily: 'monospace',
                          borderColor: isValidPythonIdentifier(i.key)
                            ? undefined
                            : 'red',
                        }}
                        title={
                          isValidPythonIdentifier(i.key)
                            ? ''
                            : 'Invalid Python identifier'
                        }
                      />
                      <button
                        type="button"
                        onClick={() => handleMoveInput(idx, 'up')}
                        disabled={idx === 0}
                        style={{ padding: '2px' }}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveInput(idx, 'down')}
                        disabled={idx === inputs.length - 1}
                        style={{ padding: '2px' }}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveInput(idx)}
                        className="danger"
                        style={{ padding: '2px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={handleAddInput}>
                  + Add Input
                </button>
              </div>

              <div className="io-column">
                <h3>Outputs</h3>
                <ul style={{ padding: 0 }}>
                  {outputs.map((o, idx) => (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: Order matters here
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: '5px',
                        marginBottom: '5px',
                        alignItems: 'center',
                      }}
                    >
                      <input
                        value={o.key}
                        onChange={(e) =>
                          handleOutputNameChange(idx, e.target.value)
                        }
                        style={{
                          flex: 1,
                          fontFamily: 'monospace',
                          borderColor: isValidPythonIdentifier(o.key)
                            ? undefined
                            : 'red',
                        }}
                        title={
                          isValidPythonIdentifier(o.key)
                            ? ''
                            : 'Invalid Python identifier'
                        }
                      />
                      <button
                        type="button"
                        onClick={() => handleMoveOutput(idx, 'up')}
                        disabled={idx === 0}
                        style={{ padding: '2px' }}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveOutput(idx, 'down')}
                        disabled={idx === outputs.length - 1}
                        style={{ padding: '2px' }}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveOutput(idx)}
                        className="danger"
                        style={{ padding: '2px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={handleAddOutput}>
                  + Add Output
                </button>
              </div>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="primary">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
