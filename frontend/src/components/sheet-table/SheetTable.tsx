import { ChevronDown, Copy, LineChart, Play } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { API_BASE } from '../../api';
import type { ParascopeNode } from '../../rete';
import './SheetTable.css';
import toast from 'react-hot-toast';
import { fallbackCopy, formatHumanReadableValue } from '../../utils';

interface ScrollButtonProps {
  onClick: () => void;
}

const ScrollButton: React.FC<ScrollButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="scroll-indicator-button"
    title="Scroll to bottom"
  >
    <ChevronDown size={20} />
  </button>
);

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

  // Filter for Descriptions (Constants, Inputs, Functions, Outputs, Sheets, Comments)
  const descriptionNodes = nodes
    .filter((node) =>
      ['constant', 'input', 'function', 'output', 'sheet', 'comment'].includes(
        node.type,
      ),
    )
    .sort((a, b) => {
      const typeOrder: Record<string, number> = {
        constant: 0,
        input: 1,
        function: 2,
        sheet: 3,
        output: 4,
        comment: 5,
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

    try {
      navigator.clipboard.writeText(tsv).then(() => {
        toast.success('Table copied to clipboard');
      });
    } catch {
      if (fallbackCopy(tsv)) {
        toast.success('Table copied to clipboard');
      } else {
        toast.error('Failed to copy table to clipboard');
      }
    }
  };

  return (
    <div className="sheet-table">
      <div className="sheet-table-constants-section">
        <div className="sheet-table-controls">
          <button
            type="button"
            onClick={onCalculate}
            disabled={isCalculating}
            className="run-button"
            title="Run Calculation"
          >
            {isCalculating ? '...' : <Play size={14} fill="currentColor" />}
            Run Calculation
          </button>
          <button
            type="button"
            onClick={onSweep}
            className="sweep-button"
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
        <div className="sheet-table-list-container">
          <div
            ref={tableContainerRef}
            onScroll={handleScroll}
            className="sheet-table-scroll-area"
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
          </div>
          {showScrollIndicator && <ScrollButton onClick={scrollToBottom} />}
        </div>
      </div>

      <div className="description-panel">
        <div className="description-panel-header">
          <h3>Descriptions</h3>
        </div>
        <div
          ref={descriptionContainerRef}
          onScroll={handleDescriptionScroll}
          className="description-list"
        >
          {descriptionNodes.map((node) => {
            const nameControl = node.controls.name as any;
            const name = nameControl?.value || node.label;
            const description = node.data?.description;
            const sheetId = node.data?.sheetId;

            if (!description && node.type !== 'sheet') return null;

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
            (n) => !n.data?.description && n.type !== 'sheet',
          ) && (
            <div className="description-empty">No descriptions available</div>
          )}
        </div>
        {showDescriptionScrollIndicator && (
          <ScrollButton onClick={scrollToDescriptionBottom} />
        )}
      </div>
    </div>
  );
};
