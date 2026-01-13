import { Trash2 } from 'lucide-react';
import type React from 'react';

interface TypeConfigProps {
  nodeType: string;
  data: Record<string, any>;
  setData: (data: Record<string, any>) => void;
}

export const TypeConfig: React.FC<TypeConfigProps> = ({
  nodeType,
  data,
  setData,
}) => {
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
                  setData({
                    ...data,
                    min: e.target.value === '' ? undefined : e.target.value,
                  })
                }
                placeholder="-Inf"
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
                  setData({
                    ...data,
                    max: e.target.value === '' ? undefined : e.target.value,
                  })
                }
                placeholder="+Inf"
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

      {nodeType === 'constant' && (
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
    </>
  );
};
