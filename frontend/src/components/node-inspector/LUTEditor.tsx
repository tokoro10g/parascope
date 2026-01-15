import { Plus, Trash2 } from 'lucide-react';
import type React from 'react';
import { useEffect } from 'react';

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
  // Ensure LUT data structure exists
  useEffect(() => {
    if (!data.lut) {
      setData({
        ...data,
        lut: {
          rows: [{ key: 'Key 1' }],
        },
      });
    }
    // LUT always has one input: the key to look up
    setInputs([{ key: 'key', socket_type: 'any' }]);
  }, [data, setData, setInputs]);

  const lut = data.lut || { rows: [{ key: 'Key 1' }] };
  const rows = lut.rows || [];

  // Get unique output keys from rows (excluding 'key')
  const outputKeys = outputs.map((o) => o.key);

  const handleAddOutput = () => {
    const name = prompt('Output Name:');
    if (name && !outputKeys.includes(name)) {
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

  const handleCellChange = (
    rowIndex: number,
    columnKey: string,
    value: string,
  ) => {
    const newRows = [...rows];
    newRows[rowIndex] = { ...newRows[rowIndex], [columnKey]: value };
    setData({
      ...data,
      lut: { ...lut, rows: newRows },
    });
  };

  return (
    <div className="lut-editor">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <h3>Look-up Table</h3>
        <button type="button" onClick={handleAddOutput}>
          + Add Output Column
        </button>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: '10px' }}>
        <table
          className="lut-table"
          style={{ width: '100%', borderCollapse: 'collapse' }}
        >
          <thead>
            <tr>
              <th
                style={{
                  border: '1px solid var(--border-color)',
                  padding: '8px',
                  background: 'var(--panel-bg-secondary)',
                }}
              >
                Key (Input)
              </th>
              {outputKeys.map((out) => (
                <th
                  key={out}
                  style={{
                    border: '1px solid var(--border-color)',
                    padding: '8px',
                    background: 'var(--panel-bg-secondary)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      justifyContent: 'center',
                    }}
                  >
                    {out}
                    <button
                      type="button"
                      className="danger"
                      style={{
                        padding: '2px',
                        minWidth: 'auto',
                        height: 'auto',
                      }}
                      onClick={() => handleRemoveOutput(out)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </th>
              ))}
              <th
                style={{
                  width: '40px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--panel-bg-secondary)',
                }}
              ></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, rowIndex: number) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: row.key might be duplicate during editing
                key={`${row.key}-${rowIndex}`}
              >
                <td
                  style={{
                    border: '1px solid var(--border-color)',
                    padding: '4px',
                  }}
                >
                  <input
                    value={row.key}
                    onChange={(e) =>
                      handleCellChange(rowIndex, 'key', e.target.value)
                    }
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                    }}
                  />
                </td>
                {outputKeys.map((out) => (
                  <td
                    key={out}
                    style={{
                      border: '1px solid var(--border-color)',
                      padding: '4px',
                    }}
                  >
                    <input
                      value={row[out] ?? ''}
                      onChange={(e) =>
                        handleCellChange(rowIndex, out, e.target.value)
                      }
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                      }}
                    />
                  </td>
                ))}
                <td
                  style={{
                    border: '1px solid var(--border-color)',
                    textAlign: 'center',
                  }}
                >
                  <button
                    type="button"
                    className="danger"
                    style={{ padding: '2px', minWidth: 'auto', height: 'auto' }}
                    onClick={() => handleRemoveRow(rowIndex)}
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={handleAddRow}
        style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
      >
        <Plus size={14} /> Add Row
      </button>
    </div>
  );
};
