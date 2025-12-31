import { Copy } from 'lucide-react';
import type React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { API_BASE } from '../api';
import type { ParascopeNode } from '../rete';

interface SheetTableProps {
  nodes: ParascopeNode[];
  onUpdateValue: (nodeId: string, value: string) => void;
  onSelectNode: (nodeId: string) => void;
}

export const SheetTable: React.FC<SheetTableProps> = ({
  nodes,
  onUpdateValue,
  onSelectNode,
}) => {
  const transformUrl = (url: string) => {
    if (url.startsWith('/attachments/')) {
      return `${API_BASE}${url}`;
    }
    return url;
  };

  // Filter for Parameters, Inputs, and Outputs
  const tableNodes = nodes
    .filter(
      (node) =>
        node.type === 'parameter' ||
        node.type === 'output' ||
        node.type === 'input',
    )
    .sort((a, b) => {
      const typeOrder: Record<string, number> = {
        input: 0,
        parameter: 1,
        output: 2,
      };
      const typeDiff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
      if (typeDiff !== 0) return typeDiff;

      // Secondary sort by position (x then y)
      if (a.x !== b.x) return (a.x || 0) - (b.x || 0);
      return (a.y || 0) - (b.y || 0);
    });

  // Filter for Descriptions (Parameters, Inputs, Functions, Outputs, Sheets)
  const descriptionNodes = nodes
    .filter((node) =>
      ['parameter', 'input', 'function', 'output', 'sheet'].includes(node.type),
    )
    .sort((a, b) => {
      const typeOrder: Record<string, number> = {
        parameter: 0,
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            padding: '0 10px',
          }}
        >
          <h3 style={{ margin: 0 }}>Parameters & I/O</h3>
          <button
            type="button"
            onClick={handleCopyTable}
            style={{
              padding: '4px 8px',
              fontSize: '0.8em',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Copy size={14} />
            Copy Table
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 10px' }}>
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
                  node.type === 'parameter' || node.type === 'input';
                const nameControl = node.controls.name as any;
                const valueControl = node.controls.value as any;

                const name = nameControl?.value || node.label;
                let value = valueControl?.value;
                const valueAsNumber = Number.parseFloat(value);
                if (!Number.isNaN(valueAsNumber) && Math.floor(valueAsNumber) !== valueAsNumber) {
                  value = valueAsNumber.toPrecision(6);
                }

                return (
                  <tr
                    key={node.id}
                    onClick={() => onSelectNode(node.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{name}</td>
                    <td>{node.type}</td>
                    <td>
                      {isEditable ? (
                        <input
                          value={value}
                          onChange={(e) =>
                            onUpdateValue(node.id, e.target.value)
                          }
                          onClick={(e) => e.stopPropagation()} // Prevent row selection when editing
                          style={{ width: '100%' }}
                        />
                      ) : (
                        <span>{value}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="description-panel"
        style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}
      >
        <h3 style={{ marginTop: 0 }}>Descriptions</h3>
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
            }}
          >
            No descriptions available.
          </div>
        )}
      </div>
    </div>
  );
};
