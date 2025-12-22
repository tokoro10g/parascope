import React from 'react';
import type { SheetSummary } from '../api';

interface EditorBarProps {
  sheets: SheetSummary[];
  currentSheetId?: string;
  onLoadSheet: (id: string) => void;
  onSaveSheet: () => void;
  onCreateSheet: () => void;
  onAddNode: (type: 'parameter' | 'function' | 'input' | 'output') => void;
}

export const EditorBar: React.FC<EditorBarProps> = ({
  sheets,
  currentSheetId,
  onLoadSheet,
  onSaveSheet,
  onCreateSheet,
  onAddNode,
}) => {
  return (
    <div className="toolbar editor-bar">
      <div className="toolbar-group">
        <select
          value={currentSheetId || ''}
          onChange={(e) => {
            if (e.target.value) onLoadSheet(e.target.value);
          }}
          className="sheet-select"
        >
          <option value="" disabled>
            Select a sheet...
          </option>
          {sheets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.owner_name ? `(${s.owner_name})` : ''}
            </option>
          ))}
        </select>
        <button 
            type="button"
            onClick={() => currentSheetId && onLoadSheet(currentSheetId)} 
            disabled={!currentSheetId}
        >
            Reload
        </button>
      </div>
      
      <div className="toolbar-group">
        <button type="button" onClick={() => onAddNode('parameter')} disabled={!currentSheetId}>+ Param</button>
        <button type="button" onClick={() => onAddNode('function')} disabled={!currentSheetId}>+ Func</button>
        <button type="button" onClick={() => onAddNode('input')} disabled={!currentSheetId}>+ Input</button>
        <button type="button" onClick={() => onAddNode('output')} disabled={!currentSheetId}>+ Output</button>
      </div>

      <div className="toolbar-group">
        <button type="button" onClick={onSaveSheet} disabled={!currentSheetId}>
          Save
        </button>
        <button type="button" onClick={onCreateSheet}>New Sheet</button>
      </div>
    </div>
  );
};
