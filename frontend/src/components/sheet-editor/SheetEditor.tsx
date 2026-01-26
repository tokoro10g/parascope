import type React from 'react';
import { Group, Separator } from 'react-resizable-panels';
import { useAuth } from '../../contexts/AuthContext';
import { NavBar } from '../NavBar';
import './SheetEditor.css';

import { SheetEditorModals } from './modals/SheetEditorModals';
// Extracted UI Components
import { SheetEditorContext } from './SheetEditorContext';
import { SheetEditorPanel } from './ui/SheetEditorPanel';
import { SheetMobileTabs } from './ui/SheetMobileTabs';
import { SheetStatusBanner } from './ui/SheetStatusBanner';
import { SheetTablePanel } from './ui/SheetTablePanel';
import { useSheetEditorLogic } from './useSheetEditorLogic';

export const SheetEditor: React.FC = () => {
  const { user, logout } = useAuth();
  const logic = useSheetEditorLogic();
  const { isMobile } = logic;

  // Custom handleBackClick for navigation
  const onBack = (e: React.MouseEvent) => {
    e.preventDefault();
    logic.handleBackClick(e);
  };

  return (
    <SheetEditorContext.Provider value={logic}>
      <div className="sheet-editor">
        <NavBar user={user} onBack={onBack} onLogout={logout} />

        <SheetStatusBanner />

        <SheetMobileTabs />

        <div
          className="editor-content"
          style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}
        >
          <div className="editor-main-wrapper">
            <Group
              id="editor-group"
              orientation="horizontal"
              style={{ width: '100%', height: '100%' }}
            >
              <SheetEditorPanel />

              <Separator
                style={{
                  width: isMobile ? '0' : '4px',
                  background: '#ccc',
                  cursor: 'col-resize',
                  display: isMobile ? 'none' : 'block',
                }}
              />

              <SheetTablePanel />
            </Group>
          </div>
        </div>

        <SheetEditorModals />
      </div>
    </SheetEditorContext.Provider>
  );
};
