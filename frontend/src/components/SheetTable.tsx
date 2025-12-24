import React from 'react';
import { ParascopeNode } from '../rete';
import { Copy } from 'lucide-react';

interface SheetTableProps {
  nodes: ParascopeNode[];
  onUpdateValue: (nodeId: string, value: number) => void;
  onSelectNode: (nodeId: string) => void;
}

export const SheetTable: React.FC<SheetTableProps> = ({ nodes, onUpdateValue, onSelectNode }) => {
  // Filter for Parameters and Outputs
  const tableNodes = nodes.filter(
    (node) => node.type === 'parameter' || node.type === 'output'
  );

  const handleCopyTable = () => {
    const headers = ['Name', 'Type', 'Value'];
    const rows = tableNodes.map((node) => {
      const nameControl = node.controls['name'] as any;
      const valueControl = node.controls['value'] as any;

      const name = nameControl?.value || node.label;
      const value = valueControl?.value || '';

      return [name, node.type, value].join('\t');
    });

    const tsv = [headers.join('\t'), ...rows].join('\n');
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(tsv).then(() => {
            console.log('Table copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopy(tsv);
        });
    } else {
        fallbackCopy(tsv);
    }
  };

  const fallbackCopy = (text: string) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      
      // Avoid scrolling to bottom
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";

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
    <div className="sheet-table">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>Parameters & Outputs</h3>
        <button type="button" onClick={handleCopyTable} style={{ padding: '4px 8px', fontSize: '0.8em', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Copy size={14} />
            Copy Table
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {tableNodes.map((node) => {
            const isParameter = node.type === 'parameter';
            const nameControl = node.controls['name'] as any;
            const valueControl = node.controls['value'] as any;
            
            const name = nameControl?.value || node.label;
            const value = valueControl?.value;

            return (
              <tr key={node.id} onClick={() => onSelectNode(node.id)} style={{ cursor: 'pointer' }}>
                <td>{name}</td>
                <td>{node.type}</td>
                <td>
                  {isParameter ? (
                    <input
                      value={value}
                      onChange={(e) => onUpdateValue(node.id, parseFloat(e.target.value))}
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
  );
};
