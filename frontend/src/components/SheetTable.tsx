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
    (node) => node.label === 'Parameter' || node.label === 'Output'
  );

  return (
    <div className="sheet-table">
      <h3>Parameters & Outputs</h3>
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
            const isParameter = node.label === 'Parameter';
            const nameControl = node.controls['name'] as any;
            const valueControl = node.controls['value'] as any;
            const unitControl = node.controls['unit'] as any;
            // For Output nodes, we might need to look at the input socket or some other state
            // But currently, Output nodes don't store the calculated value in a control.
            // The calculated value comes from the evaluator result.
            // However, the requirement says "Table view of parameters and outputs".
            // For now, let's display what we have.
            
            const name = nameControl?.value || node.label;
            const value = valueControl?.value;
            const unit = unitControl?.value || '-';

            return (
              <tr key={node.id} onClick={() => onSelectNode(node.id)} style={{ cursor: 'pointer' }}>
                <td>{name}</td>
                <td>{node.label}</td>
                <td>
                  {isParameter ? (
                    <input
                      type="number"
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
