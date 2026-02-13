import { Trash2 } from 'lucide-react';
import type React from 'react';

interface TypeConfigProps {
  nodeType: string;
  data: Record<string, any>;
  setData: (data: Record<string, any>) => void;
  inputs?: { key: string; socket_type: string }[];
  setInputs?: (inputs: { key: string; socket_type: string }[]) => void;
}

export const TypeConfig: React.FC<TypeConfigProps> = ({
  nodeType,
  data,
  setData,
  inputs,
  setInputs,
}) => {
  const hasMinInput = inputs?.some((i) => i.key === 'min');
  const hasMaxInput = inputs?.some((i) => i.key === 'max');

  const toggleInput = (key: string, enabled: boolean) => {
    if (!setInputs || !inputs) return;
    if (enabled) {
      setInputs([...inputs, { key, socket_type: 'any' }]);
      // Clear static value
      setData({ ...data, [key]: undefined });
    } else {
      setInputs(inputs.filter((i) => i.key !== key));
    }
  };

  return (
    <>
      <div className="form-group">
        <label htmlFor="node-type">Type:</label>
        <select
          id="node-type"
          value={data.dataType || 'any'}
          onChange={(e) => setData({ ...data, dataType: e.target.value })}
          style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
        >
          <option value="any">Number</option>
          <option value="option">Option (Enum)</option>
        </select>
      </div>

      {(data.dataType === 'any' || !data.dataType) && (
        <div className="form-group">
          <label
            htmlFor="node-min"
            style={{ display: 'block', marginBottom: '5px' }}
          >
            Range Validation:
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <label
                  htmlFor="node-min"
                  style={{ fontSize: '0.8em', display: 'block' }}
                >
                  Min
                </label>
                {nodeType === 'output' && (
                  <label
                    style={{
                      fontSize: '0.7em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!hasMinInput}
                      onChange={(e) => toggleInput('min', e.target.checked)}
                    />
                    Use Input
                  </label>
                )}
              </div>
              <input
                id="node-min"
                type="number"
                value={data.min !== undefined ? data.min : ''}
                onChange={(e) =>
                  setData({
                    ...data,
                    min: e.target.value === '' ? undefined : e.target.value,
                  })
                }
                placeholder={hasMinInput ? 'Driven by Input' : '-Inf'}
                disabled={!!hasMinInput}
                style={{ width: '100%', opacity: hasMinInput ? 0.7 : 1 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <label
                  htmlFor="node-max"
                  style={{ fontSize: '0.8em', display: 'block' }}
                >
                  Max
                </label>
                {nodeType === 'output' && (
                  <label
                    style={{
                      fontSize: '0.7em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!hasMaxInput}
                      onChange={(e) => toggleInput('max', e.target.checked)}
                    />
                    Use Input
                  </label>
                )}
              </div>
              <input
                id="node-max"
                type="number"
                value={data.max !== undefined ? data.max : ''}
                onChange={(e) =>
                  setData({
                    ...data,
                    max: e.target.value === '' ? undefined : e.target.value,
                  })
                }
                placeholder={hasMaxInput ? 'Driven by Input' : '+Inf'}
                disabled={!!hasMaxInput}
                style={{ width: '100%', opacity: hasMaxInput ? 0.7 : 1 }}
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

      {(nodeType === 'constant' || nodeType === 'input') && (
        <div className="form-group">
          <label htmlFor="node-value">Value:</label>
          {data.dataType === 'option' ? (
            <select
              id="node-value"
              value={data.value || ''}
              onChange={(e) => setData({ ...data, value: e.target.value })}
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
              value={data.value || ''}
              onChange={(e) => setData({ ...data, value: e.target.value })}
            />
          )}
        </div>
      )}

      {(nodeType === 'constant' || nodeType === 'output') && (
        <div
          className="form-group checkbox-group"
          style={{ marginTop: '10px' }}
        >
          <label>
            <input
              type="checkbox"
              checked={!!data.hidden}
              onChange={(e) => setData({ ...data, hidden: e.target.checked })}
            />
            <span>Hidden from table and nested sheets</span>
          </label>
        </div>
      )}
    </>
  );
};
