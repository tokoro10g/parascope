import {
  CheckCheck,
  Copy,
  FileText,
  History,
  LineChart,
  List,
  Play,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams } from 'react-router-dom';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { API_BASE, type AuditLog, api } from '../../api';
import type { ParascopeNode } from '../../rete';
import './SheetTable.css';
import toast from 'react-hot-toast';
import { copyToClipboard, formatHumanReadableValue } from '../../utils';
import { ScrollablePanel } from '../ScrollablePanel';

interface SheetTableProps {
  nodes: ParascopeNode[];
  onUpdateValue: (nodeId: string, value: string) => void;
  onSelectNode: (nodeId: string) => void;
  onCalculate: () => void;
  onSweep: () => void;
  isCalculating: boolean;
}

// Helper to group all deltas across all logs by node
const groupHistoryByNode = (history: AuditLog[], nodes: ParascopeNode[]) => {
  const nodeGroups: Record<string, { label: string; changes: any[] }> = {};

  history.forEach((log) => {
    log.delta.forEach((d) => {
      const nodeId = d.node_id || 'new-node';
      const label = d.label || '(Unknown Node)';
      if (!nodeGroups[nodeId]) {
        nodeGroups[nodeId] = { label, changes: [] };
      }
      nodeGroups[nodeId].changes.push({
        ...d,
        user_name: log.user_name,
        timestamp: log.timestamp,
        is_unread: log.is_unread,
      });
    });
  });
  return Object.entries(nodeGroups)
    .filter(([nodeId, _value]) => {
      // filter out groups with no matching nodes (e.g. deleted nodes)
      return nodes.some((n) => n.id === nodeId);
    })
    .map(([_key, value]) => value)
    .sort((a, b) => a.label.localeCompare(b.label));
};

const formatValue = (val: any) => {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

export const SheetTable: React.FC<SheetTableProps> = ({
  nodes,
  onUpdateValue,
  onSelectNode,
  onCalculate,
  onSweep,
  isCalculating,
}) => {
  const { sheetId } = useParams<{ sheetId: string }>();
  const [activeTab, setActiveTab] = useState<
    'table' | 'history' | 'descriptions'
  >('table');
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!sheetId) return;
    setIsHistoryLoading(true);
    try {
      const data = await api.getSheetHistory(sheetId);
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const handleMarkAsRead = async () => {
    if (!sheetId) return;
    try {
      await api.markSheetAsRead(sheetId);
      toast.success('All changes marked as seen');
      loadHistory(); // Refresh the list to clear highlights
    } catch (e) {
      console.error(e);
    }
  };

  const transformUrl = (url: string) => {
    if (url.startsWith('/attachments/')) {
      return `${API_BASE}${url}`;
    }
    return url;
  };

  // Filter for Constants, Inputs, and Outputs
  const tableNodes = nodes
    .filter(
      (node) =>
        node.type === 'constant' ||
        node.type === 'output' ||
        node.type === 'input',
    )
    .sort((a, b) => {
      const typeOrder: Record<string, number> = {
        input: 0,
        constant: 1,
        output: 2,
      };
      const typeDiff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
      if (typeDiff !== 0) return typeDiff;

      // Secondary sort by position (x then y)
      if (a.x !== b.x) return (a.x || 0) - (b.x || 0);
      return (a.y || 0) - (b.y || 0);
    });

  // Filter for Descriptions (Constants, Inputs, Functions, Outputs, Sheets, LUTs, Comments)
  const descriptionNodes = nodes
    .filter((node) =>
      [
        'constant',
        'input',
        'function',
        'output',
        'sheet',
        'lut',
        'comment',
      ].includes(node.type),
    )
    .sort((a, b) => {
      const typeOrder: Record<string, number> = {
        comment: 0,
        constant: 1,
        input: 2,
        function: 3,
        sheet: 4,
        lut: 5,
        output: 6,
      };
      const typeDiff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
      if (typeDiff !== 0) return typeDiff;

      // Secondary sort by position (x then y)
      if (a.x !== b.x) return (a.x || 0) - (b.x || 0);
      return (a.y || 0) - (b.y || 0);
    });

  const handleCopyTable = () => {
    const headers = ['Name', 'Type', 'Value', 'URL'];
    const rows = tableNodes.map((node) => {
      const nameControl = node.controls.name as any;
      const valueControl = node.controls.value as any;

      const name = nameControl?.value || node.label;
      const value = valueControl?.value || '';
      const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${node.id}`;

      return [name, node.type, value, url].join('\t');
    });

    const tsv = [headers.join('\t'), ...rows].join('\n');
    copyToClipboard(tsv);
  };

  return (
    <div className="sheet-table">
      {/* Content Area */}
      <div
        className="sheet-table-content"
        style={{
          flex: 1,
          overflowY: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {activeTab === 'table' && (
          <div
            className="sheet-table-constants-section"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              borderBottom: 'none',
            }}
          >
            <div className="sheet-table-controls">
              <button
                type="button"
                onClick={onCalculate}
                disabled={isCalculating}
                className="btn run-button"
                title="Run Calculation"
              >
                {isCalculating ? '...' : <Play size={14} fill="currentColor" />}
                Run Calculation
              </button>
              <button
                type="button"
                onClick={onSweep}
                className="btn sweep-button"
                title="Sweep"
              >
                <LineChart size={14} />
                Sweep
              </button>
            </div>
            <div className="sheet-table-header">
              <h3>Constants & I/O</h3>
              <div className="sheet-table-actions">
                <button
                  type="button"
                  onClick={handleCopyTable}
                  className="btn copy-button"
                  style={{ minWidth: 'unset' }}
                >
                  <Copy size={14} />
                  Copy Table
                </button>
              </div>
            </div>
            <ScrollablePanel
              className="sheet-table-scroll-area"
              dependencies={[nodes]}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th className="sheet-table-header-right">Value</th>
                  </tr>
                </thead>

                <tbody>
                  {tableNodes.map((node) => {
                    const isEditable =
                      node.type === 'constant' || node.type === 'input';
                    const isDropdown =
                      isEditable && node.data.dataType === 'option';
                    const nameControl = node.controls.name as any;
                    const valueControl = node.controls.value as any;

                    const name = nameControl?.value || node.label;
                    const value = valueControl?.value;
                    let displayValue = value;

                    if (!isEditable) {
                      if (
                        isCalculating ||
                        value === undefined ||
                        value === null ||
                        value === ''
                      ) {
                        displayValue = '?';
                      } else {
                        displayValue = formatHumanReadableValue(value);
                      }
                    }

                    const hasError = !!node.error;

                    return (
                      <tr key={node.id} onClick={() => onSelectNode(node.id)}>
                        <td>{name}</td>
                        <td>{node.type}</td>
                        <td
                          className={`sheet-table-cell-value ${
                            hasError && !isCalculating
                              ? 'value-error'
                              : !isEditable && displayValue !== '?'
                                ? 'value-blink'
                                : ''
                          }`}
                          data-error={hasError ? node.error : undefined}
                        >
                          {isDropdown ? (
                            <select
                              value={value}
                              onChange={(e) => {
                                onUpdateValue(node.id, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()} // Prevent row selection when editing
                              className="sheet-table-input"
                            >
                              <option key="" value=""></option>
                              {node.data.options.map((opt: string) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : isEditable ? (
                            <input
                              size={9}
                              value={value}
                              onChange={(e) =>
                                onUpdateValue(node.id, e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()} // Prevent row selection when editing
                              className="sheet-table-input"
                            />
                          ) : (
                            <span>{displayValue}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollablePanel>
          </div>
        )}

        {activeTab === 'descriptions' && (
          <div
            className="description-panel"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div className="description-panel-header">
              <h3>Descriptions</h3>
            </div>
            <ScrollablePanel
              className="description-list"
              dependencies={[nodes]}
            >
              {descriptionNodes.map((node) => {
                const nameControl = node.controls.name as any;
                const name = nameControl?.value || node.label;
                const description = node.data?.description;
                const sheetId = node.data?.sheetId;
                const lut = node.data?.lut;

                if (
                  !description &&
                  node.type !== 'sheet' &&
                  node.type !== 'lut'
                )
                  return null;

                return (
                  <div key={node.id} className="description-item">
                    <h4 className="description-item-header">
                      <span>{name}</span>
                      <span className="description-item-type">{node.type}</span>
                    </h4>
                    {node.type === 'sheet' && sheetId ? (
                      <div className="description-item-sheet-link">
                        <a
                          href={`/sheet/${sheetId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Referenced Sheet
                        </a>
                      </div>
                    ) : node.type === 'lut' && lut?.rows ? (
                      <div className="description-item-lut">
                        <table className="compact-table">
                          <thead>
                            <tr>
                              <th>Key</th>
                              {Object.keys(node.outputs).map((out) => (
                                <th key={out}>{out}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {lut.rows.map((row: any, i: number) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: read-only display
                              <tr key={i}>
                                <td className="monospace">{row.key}</td>
                                {Object.keys(node.outputs).map((out) => (
                                  <td key={out} className="monospace">
                                    {row.values?.[out]}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="markdown-body compact-markdown description-markdown">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          urlTransform={transformUrl}
                        >
                          {description}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              })}
              {descriptionNodes.every(
                (n) =>
                  !n.data?.description &&
                  n.type !== 'sheet' &&
                  n.type !== 'lut',
              ) && (
                <div className="description-empty">
                  No descriptions available
                </div>
              )}
            </ScrollablePanel>
          </div>
        )}

        {activeTab === 'history' && (
          <div
            className="history-panel"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div className="history-header">
              <h3>Edit History</h3>
              <button
                type="button"
                className="btn mark-read-btn"
                onClick={handleMarkAsRead}
                title="Mark all as seen"
                style={{ minWidth: 'unset' }}
              >
                <CheckCheck size={16} /> Mark all seen
              </button>
            </div>
            <ScrollablePanel
              className="history-list"
              dependencies={[nodes, history]}
            >
              {isHistoryLoading ? (
                <div className="history-empty">Loading history...</div>
              ) : history.length === 0 ? (
                <div className="history-empty">No changes recorded yet</div>
              ) : (
                groupHistoryByNode(history, nodes).map((group) => (
                  <div key={group.label} className="history-node-section">
                    <div className="history-node-header">
                      <strong>{group.label}</strong>
                    </div>
                    <div className="history-node-timeline">
                      {group.changes.map((change, i) => (
                        <div
                          // biome-ignore lint/suspicious/noArrayIndexKey: timeline display
                          key={i}
                          className={`history-timeline-item ${change.is_unread ? 'unread' : ''}`}
                        >
                          <div className="history-timeline-meta">
                            <span className="history-user">
                              {change.user_name}
                            </span>
                            <span className="history-time">
                              {new Date(change.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="history-timeline-delta">
                            <span className="delta-field">{change.field}</span>
                            <span className="delta-values">
                              {formatValue(change.old)} →{' '}
                              {formatValue(change.new)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </ScrollablePanel>
          </div>
        )}
      </div>

      <div
        className="sheet-table-tabs"
        style={{
          borderTop: '1px solid var(--border-color)',
          borderBottom: 'none',
        }}
      >
        <button
          type="button"
          className={`btn sheet-table-tab ${activeTab === 'table' ? 'active' : ''}`}
          onClick={() => setActiveTab('table')}
          style={{ minWidth: 'unset' }}
        >
          <List size={16} /> Table
        </button>
        <button
          type="button"
          className={`btn sheet-table-tab ${activeTab === 'descriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('descriptions')}
          style={{ minWidth: 'unset' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <FileText size={16} />
            <span>Descriptions</span>
          </div>
        </button>
        <button
          type="button"
          className={`btn sheet-table-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
          style={{ minWidth: 'unset' }}
        >
          <History size={16} /> History
        </button>
      </div>
    </div>
  );
};
