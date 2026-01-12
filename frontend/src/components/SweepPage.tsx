import type { EChartsOption } from 'echarts';
import ReactECharts from 'echarts-for-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, type Sheet, type SweepResultStep } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { NavBar } from './NavBar';
import { getSweepChartOption } from './sweepChartUtils';
import './SweepPage.css';

export const SweepPage: React.FC = () => {
  const { sheetId } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();
  
  const hasAutoRun = useRef(false);
  // Track if we should auto-run based on INITIAL URL params
  // This prevents auto-run triggering when user manually selects options later
  const [shouldAutoRun] = useState(() => 
    searchParams.has('input') && searchParams.has('outputs')
  );

  const [sheet, setSheet] = useState<Sheet | null>(null);

  // Initialize state from URL params if available
  const [inputNodeId, setInputNodeId] = useState<string>(
    searchParams.get('input') || '',
  );
  const [startValue, setStartValue] = useState<string>(
    searchParams.get('start') || '0',
  );
  const [endValue, setEndValue] = useState<string>(
    searchParams.get('end') || '10',
  );
  const [increment, setIncrement] = useState<string>(
    searchParams.get('step') || '1',
  );
  const [outputNodeIds, setOutputNodeIds] = useState<string[]>(() => {
    const outputs = searchParams.get('outputs');
    return outputs ? outputs.split(',') : [];
  });
  const [inputOverrides, setInputOverrides] = useState<Record<string, string>>(
    () => {
      const overrides = searchParams.get('overrides');
      try {
        return overrides ? JSON.parse(overrides) : {};
      } catch {
        return {};
      }
    },
  );

  const [results, setResults] = useState<SweepResultStep[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State to track theme colors from CSS variables
  const [theme, setTheme] = useState({
    text: '#213547',
    grid: '#ccc',
    font: 'system-ui, sans-serif',
  });

  useEffect(() => {
    if (sheetId) {
      api
        .getSheet(sheetId)
        .then((loadedSheet) => {
          setSheet(loadedSheet);
          // Initialize overrides with default values
          const defaults: Record<string, string> = {};
          loadedSheet.nodes.forEach((n) => {
            if (['constant', 'input'].includes(n.type)) {
              if (n.data && n.data.value !== undefined) {
                defaults[n.id!] = String(n.data.value);
              } else {
                defaults[n.id!] = '0';
              }
            }
          });
          // Merge defaults with existing state (URL params take precedence)
          setInputOverrides((prev) => ({ ...defaults, ...prev }));
        })
        .catch((err) => {
          console.error(err);
          const msg = 'Failed to load sheet.';
          setError(msg);
          toast.error(msg);
        });
    }
  }, [sheetId]);

  // Update theme on mount and system change
  useEffect(() => {
    const updateTheme = () => {
      const rootStyles = getComputedStyle(document.documentElement);
      const bodyStyles = getComputedStyle(document.body);

      const textColor = bodyStyles.getPropertyValue('--text-color').trim();
      const borderColor = bodyStyles.getPropertyValue('--border-color').trim();
      const fontFamily = rootStyles.getPropertyValue('font-family').trim();

      setTheme({
        text: textColor || '#213547',
        grid: borderColor || '#ccc',
        font: fontFamily || 'system-ui, Avenir, Helvetica, Arial, sans-serif',
      });
    };

    updateTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);

    // Slight delay to ensure CSS is applied
    const timer = setTimeout(updateTheme, 100);

    return () => {
      mediaQuery.removeEventListener('change', updateTheme);
      clearTimeout(timer);
    };
  }, []);

  // Sync state to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (inputNodeId) params.set('input', inputNodeId);
      params.set('start', startValue);
      params.set('end', endValue);
      params.set('step', increment);
      if (outputNodeIds.length > 0) {
        params.set('outputs', outputNodeIds.join(','));
      }
      if (Object.keys(inputOverrides).length > 0) {
        params.set('overrides', JSON.stringify(inputOverrides));
      }

      setSearchParams(params, { replace: true });
    }, 500);

    return () => clearTimeout(timer);
  }, [
    inputNodeId,
    startValue,
    endValue,
    increment,
    outputNodeIds,
    inputOverrides,
    setSearchParams,
  ]);

  const nodes = sheet?.nodes || [];
  const inputOptions = nodes.filter((n) =>
    ['constant', 'input'].includes(n.type),
  );
  const outputOptions = nodes.filter((n) => n.type === 'output');

  // Auto-select first input
  useEffect(() => {
    if (inputOptions.length > 0 && !inputNodeId) {
      setInputNodeId(inputOptions[0].id || '');
    }
  }, [inputOptions, inputNodeId]);

  const handleSweepInputChange = (id: string) => {
    setInputNodeId(id);
    const currentVal = parseFloat(inputOverrides[id] || '0');
    if (!Number.isNaN(currentVal)) {
      if (currentVal === 0) {
        setStartValue('0');
        setEndValue('10');
        setIncrement('1');
      } else {
        // Use a 50% range around the current value
        // Handle negative values correctly
        const start = currentVal > 0 ? currentVal * 0.5 : currentVal * 1.5;
        const end = currentVal > 0 ? currentVal * 1.5 : currentVal * 0.5;
        setStartValue(start.toString());
        setEndValue(end.toString());
        setIncrement(((end - start) / 20).toPrecision(2));
      }
    }
  };

  const handleRun = useCallback(async () => {
    if (!sheetId) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      if (!inputNodeId) throw new Error('Please select an input or constant.');
      if (outputNodeIds.length === 0)
        throw new Error('Please select at least one output.');

      const start = parseFloat(startValue);
      const end = parseFloat(endValue);
      const step = parseFloat(increment);

      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        Number.isNaN(step) ||
        step === 0
      ) {
        throw new Error('Invalid numeric inputs. Increment must be non-zero.');
      }

      // Construct overrides, excluding the swept node
      const currentOverrides: Record<string, string> = {};
      Object.entries(inputOverrides).forEach(([id, val]) => {
        if (id !== inputNodeId) {
          currentOverrides[id] = val;
        }
      });

      const res = await api.sweepSheet(
        sheetId,
        inputNodeId,
        startValue,
        endValue,
        increment,
        outputNodeIds,
        currentOverrides,
      );
      setResults(res.results);
    } catch (e: any) {
      const msg = e.message || 'An error occurred during sweep.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [
    sheetId,
    inputNodeId,
    outputNodeIds,
    startValue,
    endValue,
    increment,
    inputOverrides,
  ]);

  // Auto-run if URL params indicate a complete sweep config
  useEffect(() => {
    if (sheet && shouldAutoRun && !hasAutoRun.current) {
      hasAutoRun.current = true;
      handleRun();
    }
  }, [sheet, handleRun, shouldAutoRun]);

  const toggleOutput = (id: string) => {
    if (!id) return;
    setOutputNodeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/sheet/${sheetId}`);
  };

  const selectedInputLabel =
    nodes.find((n) => n.id === inputNodeId)?.label || 'Input';

  // Prepare ECharts Option
  const echartsOption: EChartsOption = useMemo(() => {
    return getSweepChartOption(results, nodes, theme, selectedInputLabel);
  }, [results, nodes, theme, selectedInputLabel]);

  return (
    <div className="sweep-page">
      <NavBar user={user} onBack={handleBack} onLogout={logout} />

      <div className="sweep-content">
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
                          onChange={() => handleSweepInputChange(n.id!)}
                        />
                      </td>
                      <td className="name-cell">{n.label}</td>
                      <td>
                        {isSweeping ? (
                          <div className="sweep-input-group">
                            <div className="sweep-input-row">
                              <label className="sweep-input-label">
                                <span>Start</span>
                                <input
                                  type="text"
                                  value={startValue}
                                  onChange={(e) =>
                                    setStartValue(e.target.value)
                                  }
                                  style={{ flex: 1 }}
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
                                  style={{ flex: 1 }}
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
                                  style={{ flex: 1 }}
                                />
                              </label>
                            </div>
                          </div>
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
                            style={{ width: '100%' }}
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
          <div
            className="sweep-table-container"
            style={{ flex: 1, overflowY: 'auto' }}
          >
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
                    style={{ cursor: 'pointer' }}
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
            className="btn-primary"
            onClick={handleRun}
            disabled={loading}
            style={{ marginTop: 'auto' }}
          >
            {loading ? 'Running...' : 'Run Sweep'}
          </button>
        </aside>

        <main className="sweep-main">
          <h2 className="sweep-header">{sheet?.name || 'Loading...'}</h2>

          {results ? (
            <div className="chart-container">
              <ReactECharts
                option={echartsOption}
                style={{ height: '100%', width: '100%' }}
                theme={undefined} // We pass styles manually
              />
            </div>
          ) : (
            <div className="empty-state">
              <p>Configure inputs and run the sweep to see results.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
