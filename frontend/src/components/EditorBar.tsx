import {
  CaseLower,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Import,
  LogIn,
  LogOut,
  MessageSquare,
  Milestone,
  MoreHorizontal,
  Plus,
  Redo,
  Save,
  Share2,
  Sigma,
  Table,
  Undo,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { NodeType } from '../rete/types';
import './EditorBar.css';

interface EditorBarProps {
  sheetName?: string;
  isDirty?: boolean;
  readOnly?: boolean;
  onRenameSheet: (name: string) => void;
  onSaveSheet: () => void;
  onOpenVersionList?: () => void;
  onAddNode: (type: NodeType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onCheckUsage?: () => void;
}

export const EditorBar: React.FC<EditorBarProps> = ({
  sheetName,
  isDirty,
  readOnly = false,
  onRenameSheet,
  onSaveSheet,
  onOpenVersionList,
  onAddNode,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onCheckUsage,
}) => {
  const [name, setName] = useState(sheetName || '');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSheetMenuOpen, setIsSheetMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const sheetMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(sheetName || '');
  }, [sheetName]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(event.target as Node)
      ) {
        setIsAddMenuOpen(false);
      }
      if (
        sheetMenuRef.current &&
        !sheetMenuRef.current.contains(event.target as Node)
      ) {
        setIsSheetMenuOpen(false);
      }
    };

    if (isAddMenuOpen || isSheetMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddMenuOpen, isSheetMenuOpen]);

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

  const handleAddNode = (type: NodeType) => {
    onAddNode(type);
    setIsAddMenuOpen(false);
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
          disabled={readOnly}
          style={readOnly ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
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
      <div className="toolbar-group node-actions-group" ref={addMenuRef}>
        <button
          type="button"
          onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
          className={`btn-add-menu-trigger ${isAddMenuOpen ? 'active' : ''}`}
          title="Add Node"
        >
          <Plus size={18} />
          <span style={{ marginLeft: '4px', fontSize: '0.9em' }}>Add Node</span>
          <ChevronDown size={14} style={{ marginLeft: '4px' }} />
        </button>

        {isAddMenuOpen && (
          <div className="add-node-dropdown">
            <button
              type="button"
              onClick={() => handleAddNode('constant')}
              className="add-menu-item item-constant"
            >
              <CaseLower size={16} /> Constant
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('input')}
              className="add-menu-item item-input"
            >
              <LogIn size={16} /> Input
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('function')}
              className="add-menu-item item-function"
            >
              <Sigma size={16} /> Function
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('output')}
              className="add-menu-item item-output"
            >
              <LogOut size={16} /> Output
            </button>
            <div className="menu-separator" />
            <button
              type="button"
              onClick={() => handleAddNode('sheet')}
              className="add-menu-item item-sheet"
            >
              <Import size={16} /> Import Sheet
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('lut')}
              className="add-menu-item item-lut"
            >
              <Table size={16} /> Lookup Table
            </button>
            <div className="menu-separator" />
            <button
              type="button"
              onClick={() => handleAddNode('comment')}
              className="add-menu-item item-comment"
            >
              <MessageSquare size={16} /> Comment
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-group history-group">
        <button
          type="button"
          onClick={(e) => {
            onUndo();
            e.currentTarget.blur();
          }}
          title="Undo"
        >
          <Undo size={18} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            onRedo();
            e.currentTarget.blur();
          }}
          title="Redo"
        >
          <Redo size={18} />
        </button>
        <div
          style={{
            width: '1px',
            height: '20px',
            backgroundColor: 'var(--border-color)',
            margin: '0 4px',
          }}
        />
        <button
          type="button"
          onClick={(e) => {
            onCopy();
            e.currentTarget.blur();
          }}
          title="Copy Selected Nodes (Ctrl+C)"
        >
          <Copy size={18} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            onPaste();
            e.currentTarget.blur();
          }}
          title="Paste Nodes (Ctrl+V)"
        >
          <ClipboardPaste size={18} />
        </button>
      </div>

      <div className="toolbar-group save-group">
        <div
          style={{
            width: '1px',
            height: '20px',
            backgroundColor: 'var(--border-color)',
            margin: '0 4px',
          }}
        />
        <div
          className="sheet-actions-group"
          ref={sheetMenuRef}
          style={{ position: 'relative' }}
        >
          <button
            type="button"
            onClick={() => setIsSheetMenuOpen(!isSheetMenuOpen)}
            className={`btn-sheet-menu-trigger ${isSheetMenuOpen ? 'active' : ''}`}
            title="Sheet Actions"
            style={{ padding: '6px', minWidth: '32px' }}
          >
            <MoreHorizontal size={18} />
          </button>

          {isSheetMenuOpen && (
            <div
              className="add-node-dropdown"
              style={{ right: 0, left: 'auto' }}
            >
              {onOpenVersionList && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenVersionList();
                    setIsSheetMenuOpen(false);
                  }}
                  className="add-menu-item"
                  style={{ color: 'var(--text-color)' }}
                >
                  <Milestone size={16} /> Version Control
                </button>
              )}
              {onCheckUsage && (
                <button
                  type="button"
                  onClick={() => {
                    onCheckUsage();
                    setIsSheetMenuOpen(false);
                  }}
                  className="add-menu-item"
                  style={{ color: 'var(--text-color)' }}
                >
                  <Share2 size={16} /> Check Usage
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            onSaveSheet();
            e.currentTarget.blur();
          }}
          disabled={!isDirty || readOnly}
          title={readOnly ? 'Read Only' : 'Save Sheet'}
          style={readOnly ? { cursor: 'not-allowed', opacity: 0.5 } : undefined}
        >
          <Save size={18} />
        </button>
      </div>
    </div>
  );
};
