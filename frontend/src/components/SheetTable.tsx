import React from 'react';
import { ParascopeNode } from '../rete';

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
    const headers = ['Name', 'Type', 'Value', 'Unit'];
    const rows = tableNodes.map((node) => {
      const nameControl = node.controls['name'] as any;
      const valueControl = node.controls['value'] as any;
      const unitControl = node.controls['unit'] as any;

      const name = nameControl?.value || node.label;
      const value = valueControl?.value || '';
      const unit = unitControl?.value || '-';

      return [name, node.type, value, unit].join('\t');
    });

    const tsv = [headers.join('\t'), ...rows].join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
        // Could add a toast here, but for now just log or rely on user action
        console.log('Table copied to clipboard');
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
  };

  return (
    <div className="sheet-table">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>Parameters & Outputs</h3>
        <button type="button" onClick={handleCopyTable} style={{ padding: '4px 8px', fontSize: '0.8em' }}>Copy Table</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Value</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {tableNodes.map((node) => {
            const isParameter = node.type === 'parameter';
            const nameControl = node.controls['name'] as any;
            const valueControl = node.controls['value'] as any;
            const unitControl = node.controls['unit'] as any;
            
            const name = nameControl?.value || node.label;
            const value = valueControl?.value;
            const unit = unitControl?.value || '-';

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
                <td>{unit}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
