import type React from 'react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { getAttachmentUrl, uploadAttachment } from '../api';
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
      // Sync value from control if it exists, as it might be newer than initialData
      if (node.controls.value) {
        const control = node.controls.value as any;
        // Check if control has a value property (it should for InputControl)
        if (control && control.value !== undefined) {
          // Try to parse as number if it looks like one, since we store value as number in data
          const val = parseFloat(control.value);
          if (!Number.isNaN(val)) {
            currentData.value = val;
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
    const name = prompt('Input name (must be a valid Python identifier):');
    if (name) {
      if (!isValidPythonIdentifier(name)) {
        alert(
          'Invalid name. Must start with a letter or underscore and contain only letters, numbers, and underscores.',
        );
        return;
      }
      if (inputs.some((i) => i.key === name)) {
        alert('Input with this name already exists.');
        return;
      }
      setInputs([...inputs, { key: name, socket_type: 'any' }]);
    }
  };

  const handleRemoveInput = (key: string) => {
    setInputs(inputs.filter((i) => i.key !== key));
  };

  const handleAddOutput = () => {
    const name = prompt('Output name (must be a valid Python identifier):');
    if (name) {
      if (!isValidPythonIdentifier(name)) {
        alert(
          'Invalid name. Must start with a letter or underscore and contain only letters, numbers, and underscores.',
        );
        return;
      }
      if (outputs.some((o) => o.key === name)) {
        alert('Output with this name already exists.');
        return;
      }
      setOutputs([...outputs, { key: name, socket_type: 'any' }]);
    }
  };

  const handleRemoveOutput = (key: string) => {
    setOutputs(outputs.filter((o) => o.key !== key));
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
                  >
                    {data.description || '*No description*'}
                  </ReactMarkdown>
                </div>
              ) : (
                <textarea
                  id="node-description"
                  value={data.description || ''}
                  onChange={(e) =>
                    setData({ ...data, description: e.target.value })
                  }
                  rows={5}
                  style={{ width: '100%', fontFamily: 'sans-serif' }}
                  placeholder="Enter description here..."
                />
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

        {(node.type === 'parameter' || node.type === 'input') &&
          node.type === 'parameter' && (
            <div className="form-group">
              <label htmlFor="node-value">Value:</label>
              <input
                id="node-value"
                type="number"
                value={data.value || 0}
                onChange={(e) =>
                  setData({ ...data, value: parseFloat(e.target.value) })
                }
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
                onChange={(e) => setData({ ...data, code: e.target.value })}
                rows={10}
                style={{ width: '100%', fontFamily: 'monospace' }}
              />
              <small>
                Use input names as variables. Assign result to output names.
              </small>
            </div>

            <div className="io-section">
              <div className="io-column">
                <h3>Inputs</h3>
                <ul>
                  {inputs.map((i) => (
                    <li key={i.key}>
                      {i.key}
                      <button
                        type="button"
                        onClick={() => handleRemoveInput(i.key)}
                      >
                        x
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
                <ul>
                  {outputs.map((o) => (
                    <li key={o.key}>
                      {o.key}
                      <button
                        type="button"
                        onClick={() => handleRemoveOutput(o.key)}
                      >
                        x
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
