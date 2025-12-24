import React, { useState, useEffect } from 'react';
import { Save, Sliders, Sigma, LogIn, LogOut, FilePlus, Undo, Redo } from 'lucide-react';

interface EditorBarProps {
  sheetName?: string;
  isDirty?: boolean;
  onRenameSheet: (name: string) => void;
  onSaveSheet: () => void;
  onAddNode: (type: 'parameter' | 'function' | 'input' | 'output' | 'sheet') => void;
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
      </div>
      <div className="toolbar-group node-actions-group">
        <button type="button" onClick={() => onAddNode('parameter')} title="Add Parameter">
            <Sliders size={18} />
        </button>
        <button type="button" onClick={() => onAddNode('function')} title="Add Function">
            <Sigma size={18} />
        </button>
        <button type="button" onClick={() => onAddNode('input')} title="Add Input Node">
            <LogIn size={18} />
        </button>
        <button type="button" onClick={() => onAddNode('output')} title="Add Output Node">
            <LogOut size={18} />
        </button>
        <button type="button" onClick={() => onAddNode('sheet')} title="Import Sheet">
            <FilePlus size={18} />
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
        <span 
            className="unsaved-indicator" 
            title="Unsaved changes" 
            style={{ 
                color: 'orange', 
                marginRight: '4px', 
                fontWeight: 'bold',
                visibility: isDirty ? 'visible' : 'hidden'
            }}
        >
            ●
        </span>
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
