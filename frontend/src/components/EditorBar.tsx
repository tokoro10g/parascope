import {
  CaseLower,
  Import,
  LogIn,
  LogOut,
  Redo,
  Save,
  Sigma,
  Undo,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import './EditorBar.css';

interface EditorBarProps {
  sheetName?: string;
  isDirty?: boolean;
  onRenameSheet: (name: string) => void;
  onSaveSheet: () => void;
  onAddNode: (
    type: 'parameter' | 'function' | 'input' | 'output' | 'sheet',
  ) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const EditorBar: React.FC<EditorBarProps> = ({
  sheetName,
  isDirty,
  onRenameSheet,
  onSaveSheet,
  onAddNode,
  onUndo,
  onRedo,
}) => {
  const [name, setName] = useState(sheetName || '');

  useEffect(() => {
    setName(sheetName || '');
  }, [sheetName]);

  const handleBlur = () => {
    if (name !== sheetName) {
      onRenameSheet(name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="toolbar editor-bar">
      <div className="toolbar-group sheet-name-group">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="sheet-name-input"
          placeholder="Sheet Name"
        />
        <span
          className="unsaved-indicator-badge"
          title="Unsaved changes"
          style={{
            color: 'orange',
            fontSize: '0.8em',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: isDirty ? 'rgba(255, 165, 0, 0.1)' : 'transparent',
            padding: '2px 8px',
            borderRadius: '12px',
            border: isDirty
              ? '1px solid rgba(255, 165, 0, 0.3)'
              : '1px solid transparent',
            visibility: isDirty ? 'visible' : 'hidden',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: '1.2em' }}>●</span>
          Unsaved
        </span>
      </div>
      <div className="toolbar-group node-actions-group">
        <button
          type="button"
          onClick={() => onAddNode('parameter')}
          title="Add Parameter"
        >
          <CaseLower size={18} />
        </button>
        <button
          type="button"
          onClick={() => onAddNode('input')}
          title="Add Input Node"
        >
          <LogIn size={18} />
        </button>
        <button
          type="button"
          onClick={() => onAddNode('output')}
          title="Add Output Node"
        >
          <LogOut size={18} />
        </button>
        <button
          type="button"
          onClick={() => onAddNode('function')}
          title="Add Function"
        >
          <Sigma size={18} />
        </button>
        <button
          type="button"
          onClick={() => onAddNode('sheet')}
          title="Import Sheet"
        >
          <Import size={18} />
        </button>
      </div>

      <div className="toolbar-group history-group">
        <button type="button" onClick={onUndo} title="Undo">
          <Undo size={18} />
        </button>
        <button type="button" onClick={onRedo} title="Redo">
          <Redo size={18} />
        </button>
      </div>

      <div className="toolbar-group save-group">
        <button
          type="button"
          onClick={onSaveSheet}
          disabled={!isDirty}
          title="Save Sheet"
        >
          <Save size={18} />
        </button>
      </div>
    </div>
  );
};
