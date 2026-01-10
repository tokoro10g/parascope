import { ChevronDown, Copy, LineChart, Play } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { API_BASE } from '../api';
import type { ParascopeNode } from '../rete';
import './SheetTable.css';
import { formatHumanReadableValue } from '../utils';

interface SheetTableProps {
  nodes: ParascopeNode[];
  onUpdateValue: (nodeId: string, value: string) => void;
  onSelectNode: (nodeId: string) => void;
  onCalculate: () => void;
  onSweep: () => void;
  isCalculating: boolean;
}

export const SheetTable: React.FC<SheetTableProps> = ({
  nodes,
  onUpdateValue,
  onSelectNode,
  onCalculate,
  onSweep,
  isCalculating,
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const descriptionContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [showDescriptionScrollIndicator, setShowDescriptionScrollIndicator] =
    useState(false);

  const checkScroll = useCallback(() => {
    const el = tableContainerRef.current;
    if (el) {
      const canScroll = el.scrollHeight > el.clientHeight;
      const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 5;
      setShowScrollIndicator(canScroll && !isAtBottom);
    }
  }, []);

  const checkDescriptionScroll = useCallback(() => {
    const el = descriptionContainerRef.current;
    if (el) {
      const canScroll = el.scrollHeight > el.clientHeight;
      const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 5;
      setShowDescriptionScrollIndicator(canScroll && !isAtBottom);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    checkDescriptionScroll();
    window.addEventListener('resize', checkScroll);
    window.addEventListener('resize', checkDescriptionScroll);
    return () => {
      window.removeEventListener('resize', checkScroll);
      window.removeEventListener('resize', checkDescriptionScroll);
    };
  }, [checkScroll, checkDescriptionScroll]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-check scroll when nodes change
  useEffect(() => {
    checkScroll();
    checkDescriptionScroll();
  }, [nodes]);

  const handleScroll = () => {
    checkScroll();
  };

  const handleDescriptionScroll = () => {
    checkDescriptionScroll();
  };

  const scrollToBottom = () => {
    const el = tableContainerRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const scrollToDescriptionBottom = () => {
    const el = descriptionContainerRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth',
      });
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

  // Filter for Descriptions (Constants, Inputs, Functions, Outputs, Sheets)
  const descriptionNodes = nodes
    .filter((node) =>
      ['constant', 'input', 'function', 'output', 'sheet'].includes(node.type),
    )
    .sort((a, b) => {
      const typeOrder: Record<string, number> = {
        constant: 0,
        input: 1,
        function: 2,
        sheet: 3,
        output: 4,
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

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(tsv)
        .then(() => {
          console.log('Table copied to clipboard');
        })
        .catch((err) => {
          console.error('Failed to copy: ', err);
          fallbackCopy(tsv);
        });
    } else {
      fallbackCopy(tsv);
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
      console.log('Fallback: Copying text command was successful');
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textArea);
  };

  return (
    <div
      className="sheet-table"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          maxHeight: '50%',
          display: 'flex',
          flexDirection: 'column',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '10px',
          marginBottom: '10px',
        }}
      >
        <div style={{ marginBottom: '10px' }}>
          <button
            type="button"
            onClick={onCalculate}
            disabled={isCalculating}
            className="run-button"
            style={{ width: '100%' }}
            title="Run Calculation"
          >
            {isCalculating ? '...' : <Play size={14} fill="currentColor" />}
            Run Calculation
          </button>
          <button
            type="button"
            onClick={onSweep}
            className="sweep-button"
            style={{ width: '100%', marginTop: '5px' }}
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
              className="copy-button"
            >
              <Copy size={14} />
              Copy Table
            </button>
          </div>
        </div>
        <div style={{ position: 'relative', overflow: 'hidden', flex: 1 }}>
          <div
            ref={tableContainerRef}
            onScroll={handleScroll}
            style={{ overflowY: 'auto', padding: '0 10px', height: '100%' }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableNodes.map((node) => {
                  const isEditable =
                    node.type === 'constant' || node.type === 'input';
                  const isDropdown =
                    isEditable && node.initialData.dataType === 'option';
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
                    <tr
                      key={node.id}
                      onClick={() => onSelectNode(node.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{name}</td>
                      <td>{node.type}</td>
                      <td
                        className={
                          hasError && !isCalculating
                            ? 'value-error'
                            : !isEditable && displayValue !== '?'
                              ? 'value-blink'
                              : ''
                        }
                        data-error={hasError ? node.error : undefined}
                        style={{
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontSize: '.8rem',
                        }}
                      >
                        {isDropdown ? (
                          <select
                            value={value}
                            onChange={(e) => {
                              onUpdateValue(node.id, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()} // Prevent row selection when editing
                            style={{
                              textAlign: 'right',
                              fontFamily: 'monospace',
                            }}
                          >
                            <option key="" value=""></option>
                            {node.initialData.options.map((opt: string) => (
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
                            style={{
                              textAlign: 'right',
                              fontFamily: 'monospace',
                            }}
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
          </div>
          {showScrollIndicator && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="scroll-indicator-button"
              title="Scroll to bottom"
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                border: 'none',
                opacity: 0.8,
                zIndex: 10,
                padding: 0,
                minWidth: '32px',
                flexShrink: 0,
              }}
            >
              <ChevronDown size={20} />
            </button>
          )}
        </div>
      </div>

      <div
        className="description-panel"
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <div style={{ padding: '0 10px', flex: '0 0 auto' }}>
          <h3 style={{ marginTop: 0 }}>Descriptions</h3>
        </div>
        <div
          ref={descriptionContainerRef}
          onScroll={handleDescriptionScroll}
          style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}
        >
          {descriptionNodes.map((node) => {
            const nameControl = node.controls.name as any;
            const name = nameControl?.value || node.label;
            const description = node.initialData?.description;
            const sheetId = node.initialData?.sheetId;

            if (!description && node.type !== 'sheet') return null;

            return (
              <div
                key={node.id}
                style={{
                  marginBottom: '8px',
                  borderBottom: '1px solid var(--border-light)',
                  paddingBottom: '8px',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 2px 0',
                    fontSize: '0.85em',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{name}</span>
                  <span
                    style={{
                      fontSize: '0.8em',
                      fontWeight: 'normal',
                      opacity: 0.7,
                    }}
                  >
                    {node.type}
                  </span>
                </h4>
                {node.type === 'sheet' && sheetId ? (
                  <div style={{ fontSize: '0.85em' }}>
                    <a
                      href={`/sheet/${sheetId}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--link-color, #007bff)' }}
                    >
                      Open Referenced Sheet
                    </a>
                  </div>
                ) : (
                  <div
                    className="markdown-body compact-markdown"
                    style={{ fontSize: '0.85em', lineHeight: '1.3' }}
                  >
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
            (n) => !n.initialData?.description && n.type !== 'sheet',
          ) && (
            <div
              style={{
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                fontSize: '0.9em',
                padding: '10px 0',
                textAlign: 'center',
              }}
            >
              No descriptions available
            </div>
          )}
        </div>
        {showDescriptionScrollIndicator && (
          <button
            type="button"
            onClick={scrollToDescriptionBottom}
            className="scroll-indicator-button"
            title="Scroll to bottom"
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              border: 'none',
              opacity: 0.8,
              zIndex: 10,
              padding: 0,
              minWidth: '32px',
              flexShrink: 0,
            }}
          >
            <ChevronDown size={20} />
          </button>
        )}
      </div>
    </div>
  );
};
