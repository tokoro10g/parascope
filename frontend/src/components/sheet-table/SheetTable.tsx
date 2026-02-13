import { Copy, FileText, Hash, LineChart, Play } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { API_BASE } from '../../api';
import type { ParascopeNode } from '../../rete';
import './SheetTable.css';
import type { NodeResult } from '../../api';
import {
  copyToClipboard,
  formatHumanReadableValue,
  getNestedSheetUrl,
} from '../../utils';
import { ScrollablePanel } from '../ScrollablePanel';

interface SheetTableProps {
  nodes: ParascopeNode[];
  onUpdateValue: (nodeId: string, value: string) => void;
  onSelectNode: (nodeId: string) => void;
  onCalculate: () => void;
  onSweep: () => void;
  isCalculating: boolean;
  activeTab?: 'variables' | 'descriptions';
  onTabChange?: (tab: 'variables' | 'descriptions') => void;
  hideTabs?: boolean;
  lastResult?: Record<string, NodeResult> | null;
}

export const SheetTable: React.FC<SheetTableProps> = ({
  nodes,
  onUpdateValue,
  onSelectNode,
  onCalculate,
  onSweep,
  isCalculating,
  activeTab: externalActiveTab,
  onTabChange,
  hideTabs = false,
  lastResult,
}) => {
  const [localActiveTab, setLocalActiveTab] = useState<
    'variables' | 'descriptions'
  >('variables');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const activeTab = externalActiveTab || localActiveTab;

  const handleTabChange = (tab: 'variables' | 'descriptions') => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setLocalActiveTab(tab);
    }
  };

  const transformUrl = (url: string) => {
    if (
      url.startsWith('/attachments/') ||
      url.startsWith('/api/v1/attachments/')
    ) {
      const normalizedUrl = url.startsWith('/attachments/')
        ? `/api/v1${url}`
        : url;
      return `${API_BASE}${normalizedUrl}`;
    }
    return url;
  };

  // Filter for Constants, Inputs, and Outputs
  const tableNodes = nodes
    .filter(
      (node) =>
        (node.type === 'constant' ||
          node.type === 'output' ||
          node.type === 'input') &&
        !node.data?.hidden,
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
    .filter(
      (node) =>
        [
          'constant',
          'input',
          'function',
          'output',
          'sheet',
          'lut',
          'comment',
        ].includes(node.type) && !node.data?.hidden,
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
      const rawValue = valueControl?.value || '';
      const value =
        node.type === 'input' && rawValue ? `( ${rawValue} )` : rawValue;
      const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${node.id}`;

      return [name, node.type, value, url].join('\t');
    });

    const tsv = [headers.join('\t'), ...rows].join('\n');
    copyToClipboard(tsv);
  };

  return (
    <div className="sheet-table">
      {!hideTabs && (
        <div className="tabs-container">
          <button
            type="button"
            className={`tab-button ${activeTab === 'variables' ? 'active' : ''}`}
            onClick={() => handleTabChange('variables')}
          >
            <Hash size={16} /> Variables
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'descriptions' ? 'active' : ''}`}
            onClick={() => handleTabChange('descriptions')}
          >
            <FileText size={16} /> Descriptions
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="sheet-table-content">
        {activeTab === 'variables' && (
          <div className="sheet-table-constants-section">
            <div
              className="sheet-table-controls"
              style={{ display: 'flex', gap: '8px' }}
            >
              <button
                type="button"
                onClick={onCalculate}
                disabled={isCalculating}
                className="btn run-button"
                title="Run Calculation"
                style={{ flex: 1 }}
              >
                {isCalculating ? '...' : <Play size={14} fill="currentColor" />}
                Run
              </button>
              <button
                type="button"
                onClick={onSweep}
                className="btn sweep-button"
                title="Sweep"
                style={{ flex: 1, marginTop: 0 }}
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
                    <th className="overflow-anywhere">Name</th>
                    <th className="overflow-anywhere">Type</th>
                    <th className="sheet-table-header-right overflow-anywhere">
                      Value
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {tableNodes.map((node) => {
                    const isFocused = focusedNodeId === node.id;
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

                    const isExample = node.type === 'input';
                    const tableDisplayValue =
                      isExample && !isFocused && value ? `( ${value} )` : value;

                    const hasError = !!node.error;
                    const typeClass = `cell-type-${node.type}`;

                    return (
                      <tr key={node.id} onClick={() => onSelectNode(node.id)}>
                        <td className={`overflow-anywhere ${typeClass}`}>
                          {name}
                        </td>
                        <td className={typeClass}>{node.type}</td>
                        <td
                          className={`sheet-table-cell-value overflow-anywhere ${
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
                              onFocus={() => setFocusedNodeId(node.id)}
                              onBlur={() => setFocusedNodeId(null)}
                              onClick={(e) => e.stopPropagation()} // Prevent row selection when editing
                              className="sheet-table-input"
                            >
                              <option key="" value=""></option>
                              {node.data.options.map((opt: string) => (
                                <option key={opt} value={opt}>
                                  {isExample && !isFocused ? `( ${opt} )` : opt}
                                </option>
                              ))}
                            </select>
                          ) : isEditable ? (
                            <input
                              size={9}
                              value={
                                isFocused
                                  ? editingValue
                                  : (tableDisplayValue ?? '')
                              }
                              key={node.id}
                              onChange={(e) => {
                                setEditingValue(e.target.value);
                              }}
                              onFocus={() => {
                                setFocusedNodeId(node.id);
                                setEditingValue(String(value ?? ''));
                              }}
                              onBlur={(e) => {
                                setFocusedNodeId(null);
                                if (e.target.value !== String(value)) {
                                  onUpdateValue(node.id, e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const target = e.target as HTMLInputElement;
                                  if (target.value !== String(value)) {
                                    onUpdateValue(node.id, target.value);
                                  }
                                  target.blur();
                                }
                              }}
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
          <div className="description-panel">
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
                          href={(() => {
                            const params = new URLSearchParams();
                            const nodeRes = lastResult?.[node.id];
                            if (nodeRes?.inputs) {
                              for (const [key, value] of Object.entries(
                                nodeRes.inputs,
                              )) {
                                if (value !== undefined && value !== null) {
                                  params.set(key, String(value));
                                }
                              }
                            }
                            return getNestedSheetUrl(
                              sheetId,
                              params,
                              node.data?.versionId,
                            );
                          })()}
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
      </div>
    </div>
  );
};
