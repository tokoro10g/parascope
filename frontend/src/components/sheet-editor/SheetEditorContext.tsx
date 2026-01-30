import { createContext, useContext } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import type { NodeResult, Sheet, SheetVersion } from '../../api';
import type { ParascopeNode } from '../../rete';
import type { NodeEditorWrapper } from '../../rete/default';
import type { NodeUpdates } from '../node-inspector/types';

export interface SheetEditorContextType {
  // State
  sheetId: string | undefined;
  currentSheet: Sheet | null;
  nodes: ParascopeNode[];
  isCalculating: boolean;
  lastResult: Record<string, NodeResult> | null;
  calculationInputs: Record<string, string>;
  editingNode: ParascopeNode | null;
  isDirty: boolean;
  isLoading: boolean;
  isReadOnly: boolean;
  isLockLoading: boolean;
  isVersionView: boolean;
  isMobile: boolean;
  activeTab: 'editor' | 'variables' | 'descriptions';
  lockedByOther: string | null;
  defaultVersionTag: string | null;
  autoCalculate: boolean;

  // Modals State
  isSheetPickerOpen: boolean;
  isUsageModalOpen: boolean;
  isVersionListOpen: boolean;
  isTakeOverModalOpen: boolean;
  isHistoryModalOpen: boolean;

  // Refs (Mutable)
  editor: NodeEditorWrapper | null;
  editorPanelRef: React.RefObject<PanelImperativeHandle | null>;
  tablePanelRef: React.RefObject<PanelImperativeHandle | null>;
  reteRef: React.RefObject<HTMLDivElement | null>;

  // Actions
  setEditingNode: (node: ParascopeNode | null) => void;
  setActiveTab: (tab: 'editor' | 'variables' | 'descriptions') => void;
  setAutoCalculate: (auto: boolean) => void;
  setIsSheetPickerOpen: (open: boolean) => void;
  setIsUsageModalOpen: (open: boolean) => void;
  setIsVersionListOpen: (open: boolean) => void;
  setIsTakeOverModalOpen: (open: boolean) => void;
  setIsHistoryModalOpen: (open: boolean) => void;

  handleRenameSheet: (name: string) => Promise<void>;
  handleSave: () => void;
  handleAddNode: (type: any) => Promise<void>;
  handleNodeUpdate: (nodeId: string, updates: NodeUpdates) => Promise<void>;
  handleImportSheet: (sheet: Sheet) => Promise<void>;
  handleImportInputs: (inputs: Record<string, string>) => void;
  handleRestoreVersion: (version: SheetVersion) => Promise<void>;
  handleSetDefault: (versionId: string | null) => Promise<void>;
  handleCopy: (data: any) => void;
  handlePaste: () => Promise<void>;
  takeOver: () => Promise<void>;

  // Table Actions
  handleUpdateNodeValue: (nodeId: string, value: string) => void;
  handleSelectNode: (nodeId: string) => void;
  handleCalculate: () => Promise<void>;
}

export const SheetEditorContext = createContext<SheetEditorContextType | null>(
  null,
);

export function useSheetEditor() {
  const context = useContext(SheetEditorContext);
  if (!context) {
    throw new Error('useSheetEditor must be used within a SheetEditorProvider');
  }
  return context;
}
