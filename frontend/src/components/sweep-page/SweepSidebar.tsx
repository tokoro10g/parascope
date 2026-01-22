import type React from 'react';
import { useState } from 'react';
import type { NodeData } from '../../api';
import './SweepPage.css';

import type { SweepAxisState } from './useSweepState';

interface SweepSidebarProps {
  inputOptions: NodeData[];
  outputOptions: NodeData[];
  // Consolidated State
  primaryInput: SweepAxisState;
  updatePrimary: (updates: Partial<SweepAxisState>) => void;
  secondaryInput: SweepAxisState;
  updateSecondary: (updates: Partial<SweepAxisState>) => void;
  onInputChange: (id: string, isSecondary?: boolean) => void;
  // Common
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
  primaryInput,
  updatePrimary,
  secondaryInput,
  updateSecondary,
  onInputChange,
  inputOverrides,
  setInputOverrides,
  outputNodeIds,
  toggleOutput,
  loading,
  error,
  onRun,
}) => {
  const [showSecondary, setShowSecondary] = useState(!!secondaryInput.nodeId);

  // Helper to render input config
  const renderInputConfig = (
    nodeId: string,
    state: SweepAxisState,
    update: (updates: Partial<SweepAxisState>) => void,
  ) => {
    const node = inputOptions.find((n) => n.id === nodeId);
    if (!node) return null;

    if (node.data?.dataType === 'option') {
      return (
        <div className="sweep-input-group" style={{ display: 'block' }}>
          <div style={{ marginBottom: 5 }}>Select Options:</div>
          <select
            multiple
            value={state.selectedOptions}
            onChange={(e) => {
              const vals = Array.from(e.target.selectedOptions, (o) => o.value);
              update({ selectedOptions: vals });
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
            {node.data.options.map((opt: string) => (
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
      );
    }

    return (
      <div className="sweep-input-group">
        <div className="sweep-input-row">
          <label className="sweep-input-label">
            <span>Start</span>
            <div className="sweep-input-flex">
              <input
                type="text"
                value={state.start}
                onChange={(e) => update({ start: e.target.value })}
              />
            </div>
          </label>
        </div>
        <div className="sweep-input-row">
          <label className="sweep-input-label">
            <span>End</span>
            <div className="sweep-input-flex">
              <input
                type="text"
                value={state.end}
                onChange={(e) => update({ end: e.target.value })}
              />
            </div>
          </label>
        </div>
        <div className="sweep-input-row">
          <label className="sweep-input-label">
            <span>Increment</span>
            <div className="sweep-input-flex">
              <input
                type="text"
                value={state.step}
                onChange={(e) => update({ step: e.target.value })}
              />
            </div>
          </label>
        </div>
      </div>
    );
  };

  const handleToggleSecondary = () => {
    if (showSecondary) {
      // Turn off
      updateSecondary({ nodeId: '' });
      setShowSecondary(false);
    } else {
      setShowSecondary(true);
      // Try to auto-select something other than primary
      const other = inputOptions.find((n) => n.id !== primaryInput.nodeId);
      if (other) {
        onInputChange(other.id!, true);
      }
    }
  };

  return (
    <aside className="sweep-sidebar">
      <h3>Primary Variable</h3>
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
              const isSweeping = primaryInput.nodeId === n.id;
              const isSecondary = secondaryInput.nodeId === n.id;
              return (
                <tr key={n.id}>
                  <td className="checkbox-cell">
                    <input
                      type="radio"
                      name="sweep-input-primary"
                      checked={isSweeping}
                      disabled={isSecondary}
                      onChange={() => onInputChange(n.id!, false)}
                    />
                  </td>
                  <td className="name-cell">{n.label}</td>
                  <td>
                    {isSweeping ? (
                      renderInputConfig(n.id!, primaryInput, updatePrimary)
                    ) : isSecondary ? (
                      <div
                        style={{
                          fontStyle: 'italic',
                          color: 'var(--primary-color)',
                        }}
                      >
                        (Secondary Sweep Variable)
                      </div>
                    ) : n.data?.dataType === 'option' ? (
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

      <div style={{ marginTop: '15px' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={showSecondary}
            onChange={handleToggleSecondary}
          />
          <h3 style={{ margin: 0 }}>Secondary Variable</h3>
        </label>
      </div>

      {showSecondary && (
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
                const isSweeping = secondaryInput.nodeId === n.id;
                const isPrimary = primaryInput.nodeId === n.id;
                return (
                  <tr key={n.id}>
                    <td className="checkbox-cell">
                      <input
                        type="radio"
                        name="sweep-input-secondary"
                        checked={isSweeping}
                        disabled={isPrimary}
                        onChange={() => onInputChange(n.id!, true)}
                      />
                    </td>
                    <td className="name-cell">{n.label}</td>
                    <td>
                      {isSweeping ? (
                        renderInputConfig(
                          n.id!,
                          secondaryInput,
                          updateSecondary,
                        )
                      ) : isPrimary ? (
                        <div
                          style={{
                            fontStyle: 'italic',
                            color: 'var(--primary-color)',
                          }}
                        >
                          (Primary Sweep Variable)
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)' }}>-</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
