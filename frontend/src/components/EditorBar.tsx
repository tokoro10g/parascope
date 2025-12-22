import React, { useState, useEffect } from 'react';

interface EditorBarProps {
  sheetName?: string;
  isDirty?: boolean;
  onRenameSheet: (name: string) => void;
  onSaveSheet: () => void;
  onAddNode: (type: 'parameter' | 'function' | 'input' | 'output') => void;
}

export const EditorBar: React.FC<EditorBarProps> = ({
  sheetName,
  isDirty,
  onRenameSheet,
  onSaveSheet,
  onAddNode,
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
      <div className="toolbar-group">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="sheet-name-input"
          placeholder="Sheet Name"
        />
        {isDirty && <span className="unsaved-indicator" title="Unsaved changes" style={{ color: 'orange', marginRight: '8px', fontWeight: 'bold' }}>●</span>}
        <button 
            type="button"
            onClick={onSaveSheet}
            disabled={!isDirty}
        >
            Save
        </button>
      </div>
      
      <div className="toolbar-group">
        <button type="button" onClick={() => onAddNode('parameter')}>+ Param</button>
        <button type="button" onClick={() => onAddNode('function')}>+ Func</button>
        <button type="button" onClick={() => onAddNode('input')}>+ Input</button>
        <button type="button" onClick={() => onAddNode('output')}>+ Output</button>
      </div>
    </div>
  );
};
