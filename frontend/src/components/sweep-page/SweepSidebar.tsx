import type React from 'react';
import { useState } from 'react';
import type { NodeData } from '../../api';
import './SweepPage.css';

interface SweepSidebarProps {
  inputOptions: NodeData[];
  outputOptions: NodeData[];
  // Primary
  inputNodeId: string;
  onInputChange: (id: string, isSecondary?: boolean) => void;
  startValue: string;
  setStartValue: (v: string) => void;
  endValue: string;
  setEndValue: (v: string) => void;
  increment: string;
  setIncrement: (v: string) => void;
  selectedOptions: string[];
  setSelectedOptions: (v: string[]) => void;
  // Secondary
  secondaryInputNodeId: string;
  setSecondaryInputNodeId: (id: string) => void;
  secondaryStartValue: string;
  setSecondaryStartValue: (v: string) => void;
  secondaryEndValue: string;
  setSecondaryEndValue: (v: string) => void;
  secondaryIncrement: string;
  setSecondaryIncrement: (v: string) => void;
  secondarySelectedOptions: string[];
  setSecondarySelectedOptions: (v: string[]) => void;
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
  secondaryInputNodeId,
  setSecondaryInputNodeId,
  secondaryStartValue,
  setSecondaryStartValue,
  secondaryEndValue,
  setSecondaryEndValue,
  secondaryIncrement,
  setSecondaryIncrement,
  secondarySelectedOptions,
  setSecondarySelectedOptions,
  inputOverrides,
  setInputOverrides,
  outputNodeIds,
  toggleOutput,
  loading,
  error,
  onRun,
}) => {
  const [showSecondary, setShowSecondary] = useState(!!secondaryInputNodeId);

  // Helper to render input config
  const renderInputConfig = (
    _isSecondary: boolean,
    nodeId: string,
    start: string,
    setStart: (v: string) => void,
    end: string,
    setEnd: (v: string) => void,
    step: string,
    setStep: (v: string) => void,
    selOpts: string[],
    setSelOpts: (v: string[]) => void,
  ) => {
    const node = inputOptions.find((n) => n.id === nodeId);
    if (!node) return null;

    if (node.data?.dataType === 'option') {
      return (
        <div className="sweep-input-group" style={{ display: 'block' }}>
          <div style={{ marginBottom: 5 }}>Select Options:</div>
          <select
            multiple
            value={selOpts}
            onChange={(e) => {
              const vals = Array.from(e.target.selectedOptions, (o) => o.value);
              setSelOpts(vals);
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
                value={start}
                onChange={(e) => setStart(e.target.value)}
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
                value={end}
                onChange={(e) => setEnd(e.target.value)}
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
                value={step}
                onChange={(e) => setStep(e.target.value)}
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
      setSecondaryInputNodeId('');
      setShowSecondary(false);
    } else {
      setShowSecondary(true);
      // Try to auto-select something other than primary
      const other = inputOptions.find((n) => n.id !== inputNodeId);
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
              const isSweeping = inputNodeId === n.id;
              const isSecondary = secondaryInputNodeId === n.id;
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
                      renderInputConfig(
                        false,
                        n.id!,
                        startValue,
                        setStartValue,
                        endValue,
                        setEndValue,
                        increment,
                        setIncrement,
                        selectedOptions,
                        setSelectedOptions,
                      )
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
                const isSweeping = secondaryInputNodeId === n.id;
                const isPrimary = inputNodeId === n.id;
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
                          true,
                          n.id!,
                          secondaryStartValue,
                          setSecondaryStartValue,
                          secondaryEndValue,
                          setSecondaryEndValue,
                          secondaryIncrement,
                          setSecondaryIncrement,
                          secondarySelectedOptions,
                          setSecondarySelectedOptions,
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
