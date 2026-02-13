import type React from 'react';
import { Group, Separator } from 'react-resizable-panels';
import { useAuth } from '../../core/contexts/AuthContext';
import { NavBar } from '../../components/ui/NavBar';
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

        <div className="editor-content">
          <div className="editor-main-wrapper">
            <Group
              id="editor-group"
              orientation="horizontal"
              className="editor-group"
            >
              <SheetEditorPanel />

              <Separator
                className={`resizable-separator ${isMobile ? 'mobile-hidden' : ''}`}
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
