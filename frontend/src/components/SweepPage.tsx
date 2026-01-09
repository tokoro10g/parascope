import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { api, type Sheet, type SweepResultStep } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { NavBar } from './NavBar';
import './SweepPage.css';

export const SweepPage: React.FC = () => {
  const { sheetId } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [inputNodeId, setInputNodeId] = useState<string>('');
  const [startValue, setStartValue] = useState<string>('0');
  const [endValue, setEndValue] = useState<string>('10');
  const [increment, setIncrement] = useState<string>('1');
  const [outputNodeIds, setOutputNodeIds] = useState<string[]>([]);
  const [inputOverrides, setInputOverrides] = useState<Record<string, string>>({});
  
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
      api.getSheet(sheetId).then((loadedSheet) => {
        setSheet(loadedSheet);
        // Initialize overrides with default values
        const defaults: Record<string, string> = {};
        loadedSheet.nodes.forEach(n => {
            if (['parameter', 'input'].includes(n.type)) {
                if (n.data && n.data.value !== undefined) {
                    defaults[n.id!] = String(n.data.value);
                } else {
                    defaults[n.id!] = '0';
                }
            }
        });
        setInputOverrides(defaults);
      }).catch((err) => {
        console.error(err);
        setError('Failed to load sheet.');
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

  const nodes = sheet?.nodes || [];
  const inputOptions = nodes.filter((n) =>
    ['parameter', 'input'].includes(n.type),
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
    if (!isNaN(currentVal)) {
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

  const handleRun = async () => {
    if (!sheetId) return;
    setLoading(true);
    setError(null);
    setResults(null); 
    try {
      if (!inputNodeId) throw new Error('Please select an input parameter.');
      if (outputNodeIds.length === 0)
        throw new Error('Please select at least one output.');

      const start = parseFloat(startValue);
      const end = parseFloat(endValue);
      const step = parseFloat(increment);

      if (isNaN(start) || isNaN(end) || isNaN(step) || step === 0) {
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
        currentOverrides
      );
      setResults(res.results);
    } catch (e: any) {
      setError(e.message || 'An error occurred during sweep.');
    } finally {
      setLoading(false);
    }
  };

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
    if (!results || results.length === 0) return {};

    const plottedIds = Object.keys(results[0].outputs);

    const series = plottedIds.map((id) => {
      const node = nodes.find((n) => n.id === id);
      const label = node ? node.label : id;
      
      const data = results.map(r => [r.input_value, r.outputs[id]]);
      
      return {
        name: label,
        type: 'line',
        data: data,
        symbolSize: 6,
        showSymbol: true,
      };
    });

    return {
      backgroundColor: 'transparent',
      textStyle: {
        fontFamily: theme.font,
        color: theme.text,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        backgroundColor: theme.grid,
        textStyle: {
          color: theme.text
        },
        borderColor: theme.text,
      },
      legend: {
        bottom: 0,
        textStyle: {
          color: theme.text,
        },
      },
      grid: {
        top: 60,
        right: 40,
        bottom: 60,
        left: 60,
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: selectedInputLabel,
        nameLocation: 'middle',
        nameGap: 30,
        scale: true,
        axisLine: {
          lineStyle: {
            color: theme.text,
          },
        },
        axisLabel: {
          color: theme.text,
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: theme.grid,
          },
        },
      },
      yAxis: {
        type: 'value',
        name: 'Output Value',
        nameLocation: 'middle',
        nameGap: 40,
        scale: true,
        boundaryGap: ['5%', '5%'],
        axisLine: {
          lineStyle: {
            color: theme.text,
          },
        },
        axisLabel: {
          color: theme.text,
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: theme.grid,
          },
        },
      },
      series: series as any,
    };
  }, [results, outputNodeIds, nodes, theme, selectedInputLabel]);

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
                          <th style={{width: '60px', textAlign: 'center'}}>Sweep</th>
                          <th style={{width: '200px'}}>Name</th>
                          <th>Value / Range</th>
                      </tr>
                  </thead>
                  <tbody>
                      {inputOptions.map(n => {
                          const isSweeping = inputNodeId === n.id;
                          return (
                              <tr key={n.id}>
                                  <td style={{textAlign: 'center', verticalAlign: 'middle'}}>
                                      <input 
                                        type="radio" 
                                        name="sweep-input" 
                                        checked={isSweeping} 
                                        onChange={() => handleSweepInputChange(n.id!)}
                                      />
                                  </td>
                                  <td style={{verticalAlign: 'middle'}}>
                                      {n.label}
                                  </td>
                                  <td>
                                      {isSweeping ? (
                                          <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                                  <label style={{minWidth: '75px', fontSize: '0.8em', color: 'var(--text-secondary)'}}>Start</label>
                                                  <input type="text" value={startValue} onChange={e => setStartValue(e.target.value)} style={{flex: 1}} />
                                              </div>
                                              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                                  <label style={{minWidth: '75px', fontSize: '0.8em', color: 'var(--text-secondary)'}}>End</label>
                                                  <input type="text" value={endValue} onChange={e => setEndValue(e.target.value)} style={{flex: 1}} />
                                              </div>
                                              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                                  <label style={{minWidth: '75px', fontSize: '0.8em', color: 'var(--text-secondary)'}}>Increment</label>
                                                  <input type="text" value={increment} onChange={e => setIncrement(e.target.value)} style={{flex: 1}} />
                                              </div>
                                          </div>
                                      ) : (
                                          <input 
                                            type="text" 
                                            value={inputOverrides[n.id!] || ''} 
                                            onChange={(e) => setInputOverrides(prev => ({...prev, [n.id!]: e.target.value}))}
                                            style={{width: '100%'}}
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
          <div className="sweep-table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="sweep-table">
              <thead>
                <tr>
                  <th style={{width: '60px', textAlign: 'center'}}>Plot</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {outputOptions.map((n) => (
                  <tr key={n.id} onClick={() => toggleOutput(n.id!)} style={{cursor: 'pointer'}}>
                    <td style={{textAlign: 'center', verticalAlign: 'middle'}}>
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
            className="btn-primary"
            onClick={handleRun}
            disabled={loading}
            style={{marginTop: 'auto'}}
          >
            {loading ? 'Running...' : 'Run Sweep'}
          </button>
        </aside>

        <main className="sweep-main">
          <h2 style={{ margin: '0 0 20px 0', fontSize: '1.5em' }}>{sheet?.name || 'Loading...'}</h2>
          
          {results ? (
            <div className="chart-container" style={{ position: 'relative', flex: 1, width: '100%', minHeight: 0 }}>
              <ReactECharts
                option={echartsOption}
                style={{ height: '100%', width: '100%' }}
                theme={undefined} // We pass styles manually
              />
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#888',
                border: '2px dashed var(--border-color)',
                borderRadius: '8px',
                minHeight: '200px'
              }}
            >
              <p>Configure inputs and run the sweep to see results.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};