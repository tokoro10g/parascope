import type React from 'react';
import type { NodeData } from '../../api';
import './SweepPage.css';

interface SweepSidebarProps {
  inputOptions: NodeData[];
  outputOptions: NodeData[];
  inputNodeId: string;
  onInputChange: (id: string) => void;
  startValue: string;
  setStartValue: (v: string) => void;
  endValue: string;
  setEndValue: (v: string) => void;
  increment: string;
  setIncrement: (v: string) => void;
  selectedOptions: string[];
  setSelectedOptions: (v: string[]) => void;
  inputOverrides: Record<string, string>;
  setInputOverrides: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  outputNodeIds: string[];
  toggleOutput: (id: string) => void;
  loading: boolean;
  error: string | null;
  onRun: () => void;
}

export const SweepSidebar: React.FC<SweepSidebarProps> = ({
  inputOptions,
  outputOptions,
  inputNodeId,
  onInputChange,
  startValue,
  setStartValue,
  endValue,
  setEndValue,
  increment,
  setIncrement,
  selectedOptions,
  setSelectedOptions,
  inputOverrides,
  setInputOverrides,
  outputNodeIds,
  toggleOutput,
  loading,
  error,
  onRun,
}) => {
  return (
    <aside className="sweep-sidebar">
      <h3>Inputs</h3>
      <div className="sweep-table-container">
        <table className="sweep-table">
          <thead>
            <tr>
              <th className="checkbox-col">Sweep</th>
              <th className="name-col">Name</th>
              <th>Value / Range</th>
            </tr>
          </thead>
          <tbody>
            {inputOptions.map((n) => {
              const isSweeping = inputNodeId === n.id;
              return (
                <tr key={n.id}>
                  <td className="checkbox-cell">
                    <input
                      type="radio"
                      name="sweep-input"
                      checked={isSweeping}
                      onChange={() => onInputChange(n.id!)}
                    />
                  </td>
                  <td className="name-cell">{n.label}</td>
                  <td>
                    {isSweeping ? (
                      Array.isArray(n.data?.options) ? (
                        <div
                          className="sweep-input-group"
                          style={{ display: 'block' }}
                        >
                          <div style={{ marginBottom: 5 }}>Select Options:</div>
                          <select
                            multiple
                            value={selectedOptions}
                            onChange={(e) => {
                              const vals = Array.from(
                                e.target.selectedOptions,
                                (o) => o.value,
                              );
                              setSelectedOptions(vals);
                            }}
                            style={{
                              width: '100%',
                              height: '100px',
                              padding: 5,
                              border: '1px solid var(--border-color)',
                              borderRadius: 4,
                              background: 'var(--bg-color)',
                              color: 'var(--text-color)',
                            }}
                          >
                            {n.data.options.map((opt: string) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <div
                            style={{
                              fontSize: '0.8em',
                              color: 'var(--text-muted)',
                              marginTop: 4,
                            }}
                          >
                            Hold Ctrl/Cmd to select multiple
                          </div>
                        </div>
                      ) : (
                        <div className="sweep-input-group">
                          <div className="sweep-input-row">
                            <label className="sweep-input-label">
                              <span>Start</span>
                              <input
                                type="text"
                                value={startValue}
                                onChange={(e) => setStartValue(e.target.value)}
                                className="sweep-input-flex"
                              />
                            </label>
                          </div>
                          <div className="sweep-input-row">
                            <label className="sweep-input-label">
                              <span>End</span>
                              <input
                                type="text"
                                value={endValue}
                                onChange={(e) => setEndValue(e.target.value)}
                                className="sweep-input-flex"
                              />
                            </label>
                          </div>
                          <div className="sweep-input-row">
                            <label className="sweep-input-label">
                              <span>Increment</span>
                              <input
                                type="text"
                                value={increment}
                                onChange={(e) => setIncrement(e.target.value)}
                                className="sweep-input-flex"
                              />
                            </label>
                          </div>
                        </div>
                      )
                    ) : Array.isArray(n.data?.options) ? (
                      <select
                        value={inputOverrides[n.id!] || ''}
                        onChange={(e) =>
                          setInputOverrides((prev) => ({
                            ...prev,
                            [n.id!]: e.target.value,
                          }))
                        }
                        className="sweep-input-full"
                        style={{
                          background: 'var(--bg-color)',
                          color: 'var(--text-color)',
                          border: '1px solid var(--border-color)',
                          padding: '4px',
                        }}
                      >
                        {inputOverrides[n.id!] &&
                          !n.data.options.includes(inputOverrides[n.id!]) && (
                            <option value={inputOverrides[n.id!]}>
                              {inputOverrides[n.id!]}
                            </option>
                          )}
                        {n.data.options.map((opt: string) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={inputOverrides[n.id!] || ''}
                        onChange={(e) =>
                          setInputOverrides((prev) => ({
                            ...prev,
                            [n.id!]: e.target.value,
                          }))
                        }
                        className="sweep-input-full"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Outputs</h3>
      <div className="sweep-table-container sweep-outputs-container">
        <table className="sweep-table">
          <thead>
            <tr>
              <th className="checkbox-col">Plot</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {outputOptions.map((n) => (
              <tr
                key={n.id}
                onClick={() => toggleOutput(n.id!)}
                className="sweep-output-row"
              >
                <td className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={outputNodeIds.includes(n.id!)}
                    onChange={() => toggleOutput(n.id!)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td>{n.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        type="button"
        className="btn-primary sweep-run-button"
        onClick={onRun}
        disabled={loading}
      >
        {loading ? 'Running...' : 'Run Sweep'}
      </button>
    </aside>
  );
};
