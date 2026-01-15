import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Plus,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import './LUTEditor.css';

interface LUTEditorProps {
  data: Record<string, any>;
  setData: (data: Record<string, any>) => void;
  outputs: { key: string; socket_type: string }[];
  setOutputs: (outputs: { key: string; socket_type: string }[]) => void;
  setInputs: (inputs: { key: string; socket_type: string }[]) => void;
}

export const LUTEditor: React.FC<LUTEditorProps> = ({
  data,
  setData,
  outputs,
  setOutputs,
  setInputs,
}) => {
  const [tempKeys, setTempKeys] = useState<string[]>([]);
  const [tempOutputs, setTempOutputs] = useState<string[]>([]);

  const lut = data.lut || { rows: [] };
  const rows = lut.rows || [];

  // Ensure inputs are set for LUT on mount
  useEffect(() => {
    setInputs([{ key: 'key', socket_type: 'any' }]);
  }, [setInputs]);

  // Sync temp state with real data whenever it changes
  useEffect(() => {
    setTempKeys(rows.map((r: any) => r.key));
  }, [rows]);

  useEffect(() => {
    setTempOutputs(outputs.map((o) => o.key));
  }, [outputs]);

  // Get unique output keys for logic
  const outputKeys = outputs.map((o) => o.key);

  const handleAddOutput = () => {
    let nextNum = outputs.length + 1;
    let defaultName = `Output ${nextNum}`;
    while (outputKeys.includes(defaultName)) {
      nextNum++;
      defaultName = `Output ${nextNum}`;
    }

    const name = defaultName;
    if (!outputKeys.includes(name)) {
      const newOutputs = [...outputs, { key: name, socket_type: 'any' }];
      setOutputs(newOutputs);

      // Update all rows to include the new output
      const newRows = rows.map((row: any) => ({ ...row, [name]: 0 }));
      setData({
        ...data,
        lut: { ...lut, rows: newRows },
      });
    }
  };

  const handleRenameOutput = (index: number, newKey: string) => {
    const oldKey = outputs[index].key;
    if (!newKey || newKey === oldKey) {
      // Revert to original if empty or same
      const updated = [...tempOutputs];
      updated[index] = oldKey;
      setTempOutputs(updated);
      return;
    }

    if (outputKeys.includes(newKey)) {
      toast.error(`Output "${newKey}" already exists.`);
      const updated = [...tempOutputs];
      updated[index] = oldKey;
      setTempOutputs(updated);
      return;
    }

    // 1. Update node outputs
    const newOutputs = [...outputs];
    newOutputs[index] = { ...newOutputs[index], key: newKey };
    setOutputs(newOutputs);

    // 2. Update data in rows
    const newRows = rows.map((row: any) => {
      const newRow = { ...row };
      newRow[newKey] = newRow[oldKey];
      delete newRow[oldKey];
      return newRow;
    });

    setData({
      ...data,
      lut: { ...lut, rows: newRows },
    });
  };

  const handleRenameKey = (index: number, newKey: string) => {
    const oldKey = rows[index].key;
    if (!newKey || newKey === oldKey) {
      const updated = [...tempKeys];
      updated[index] = oldKey;
      setTempKeys(updated);
      return;
    }

    // Check for uniqueness excluding current index

    const otherKeys = rows

      .filter((_: any, i: number) => i !== index)

      .map((r: any) => r.key);
    if (otherKeys.includes(newKey)) {
      toast.error(`Key "${newKey}" already exists.`);
      const updated = [...tempKeys];
      updated[index] = oldKey;
      setTempKeys(updated);
      return;
    }

    const newRows = [...rows];
    newRows[index] = { ...newRows[index], key: newKey };
    setData({
      ...data,
      lut: { ...lut, rows: newRows },
    });
  };

  const handleRemoveOutput = (key: string) => {
    const newOutputs = outputs.filter((o) => o.key !== key);
    setOutputs(newOutputs);

    // Update all rows to remove the output
    const newRows = rows.map((row: any) => {
      const newRow = { ...row };
      delete newRow[key];
      return newRow;
    });
    setData({
      ...data,
      lut: { ...lut, rows: newRows },
    });
  };

  const handleMoveOutput = (index: number, direction: 'left' | 'right') => {
    const newOutputs = [...outputs];
    if (direction === 'left' && index > 0) {
      [newOutputs[index], newOutputs[index - 1]] = [
        newOutputs[index - 1],
        newOutputs[index],
      ];
    } else if (direction === 'right' && index < outputs.length - 1) {
      [newOutputs[index], newOutputs[index + 1]] = [
        newOutputs[index + 1],
        newOutputs[index],
      ];
    }
    setOutputs(newOutputs);
  };

  const handleAddRow = () => {
    const newRow: any = { key: `Key ${rows.length + 1}` };
    for (const out of outputKeys) {
      newRow[out] = 0;
    }
    setData({
      ...data,
      lut: { ...lut, rows: [...rows, newRow] },
    });
  };

  const handleRemoveRow = (index: number) => {
    const newRows = [...rows];
    newRows.splice(index, 1);
    setData({
      ...data,
      lut: { ...lut, rows: newRows },
    });
  };

  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    const newRows = [...rows];
    if (direction === 'up' && index > 0) {
      [newRows[index], newRows[index - 1]] = [
        newRows[index - 1],
        newRows[index],
      ];
    } else if (direction === 'down' && index < rows.length - 1) {
      [newRows[index], newRows[index + 1]] = [
        newRows[index + 1],
        newRows[index],
      ];
    }
    setData({
      ...data,
      lut: { ...lut, rows: newRows },
    });
  };

  const handleCellChange = (
    rowIndex: number,
    columnKey: string,
    value: string,
  ) => {
    const newRows = [...rows];
    newRows[rowIndex] = { ...newRows[rowIndex], [columnKey]: value };

    // Explicitly update data to trigger re-render
    setData({
      ...data,
      lut: {
        ...lut,
        rows: newRows,
      },
    });
  };

  return (
    <div className="lut-editor">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Look-up Table</h3>
      </div>

      <div className="lut-table-container">
        <table className="lut-table">
          <thead>
            <tr>
              <th>Key (Input)</th>
              {outputs.map((out, idx) => (
                <th key={out.key}>
                  <div className="lut-header-cell">
                    <div className="lut-header-actions">
                      <button
                        type="button"
                        className="lut-icon-btn"
                        onClick={() => handleMoveOutput(idx, 'left')}
                        disabled={idx === 0}
                        title="Move Left"
                      >
                        <ArrowLeft size={12} />
                      </button>
                      <button
                        type="button"
                        className="lut-icon-btn"
                        onClick={() => handleMoveOutput(idx, 'right')}
                        disabled={idx === outputs.length - 1}
                        title="Move Right"
                      >
                        <ArrowRight size={12} />
                      </button>
                      <button
                        type="button"
                        className="lut-remove-btn"
                        onClick={() => handleRemoveOutput(out.key)}
                        title="Remove Column"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="lut-header-main">
                      <input
                        value={tempOutputs[idx] ?? out.key}
                        onChange={(e) => {
                          const updated = [...tempOutputs];
                          updated[idx] = e.target.value;
                          setTempOutputs(updated);
                        }}
                        onBlur={(e) => handleRenameOutput(idx, e.target.value)}
                        className="lut-header-input"
                        title="Rename Output"
                      />
                    </div>
                  </div>
                </th>
              ))}
              <th style={{ width: '32px', borderRight: 'none', padding: 0 }}>
                <button
                  type="button"
                  className="lut-add-inline-btn"
                  onClick={handleAddOutput}
                  title="Add Column"
                >
                  <Plus size={14} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, rowIndex: number) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: composite key for stability
                key={`${row.key}-${rowIndex}`}
              >
                <td>
                  <input
                    value={tempKeys[rowIndex] ?? row.key}
                    onChange={(e) => {
                      const updated = [...tempKeys];
                      updated[rowIndex] = e.target.value;
                      setTempKeys(updated);
                    }}
                    onBlur={(e) => handleRenameKey(rowIndex, e.target.value)}
                  />
                </td>
                {outputs.map((out) => (
                  <td key={out.key}>
                    <input
                      value={row[out.key] ?? ''}
                      onChange={(e) =>
                        handleCellChange(rowIndex, out.key, e.target.value)
                      }
                    />
                  </td>
                ))}
                <td style={{ borderRight: 'none' }}>
                  <div className="lut-row-actions">
                    <button
                      type="button"
                      className="lut-icon-btn"
                      onClick={() => handleMoveRow(rowIndex, 'up')}
                      disabled={rowIndex === 0}
                      title="Move Up"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="lut-icon-btn"
                      onClick={() => handleMoveRow(rowIndex, 'down')}
                      disabled={rowIndex === rows.length - 1}
                      title="Move Down"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      className="lut-remove-btn"
                      onClick={() => handleRemoveRow(rowIndex)}
                      title="Remove Row"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td
                colSpan={outputs.length + 2}
                style={{ borderRight: 'none', borderBottom: 'none' }}
              >
                <button
                  type="button"
                  className="lut-add-row-inline-btn"
                  onClick={handleAddRow}
                >
                  <Plus size={14} /> Add Row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
