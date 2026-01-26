import type React from 'react';
import type { Sheet, SheetVersion } from '../../../api';
import type { ParascopeNode } from '../../../rete';
import { HistoryModal } from '../../HistoryModal';
import { Modal } from '../../Modal';
import { NodeInspector } from '../../node-inspector';
import type { NodeUpdates } from '../../node-inspector/types';
import { SheetPickerModal } from '../../SheetPickerModal';
import { SheetUsageModal } from '../../SheetUsageModal';
import { VersionListModal } from '../../VersionListModal';

interface SheetEditorModalsProps {
  editingNode: ParascopeNode | null;
  setEditingNode: (node: ParascopeNode | null) => void;
  handleNodeUpdate: (nodeId: string, updates: NodeUpdates) => Promise<void>;
  isSheetPickerOpen: boolean;
  setIsSheetPickerOpen: (open: boolean) => void;
  handleImportSheet: (sheet: Sheet) => Promise<void>;
  currentSheet: Sheet | null;
  isUsageModalOpen: boolean;
  setIsUsageModalOpen: (open: boolean) => void;
  handleImportInputs: (inputs: Record<string, string>) => void;
  isVersionListOpen: boolean;
  setIsVersionListOpen: (open: boolean) => void;
  handleRestoreVersion: (version: SheetVersion) => Promise<void>;
  handleSetDefault: (versionId: string | null) => Promise<void>;
  isDirty: boolean;
  isHistoryModalOpen: boolean;
  setIsHistoryModalOpen: (open: boolean) => void;
  nodes: ParascopeNode[];
  isTakeOverModalOpen: boolean;
  setIsTakeOverModalOpen: (open: boolean) => void;
  lockedByOther: string | null;
  takeOver: () => Promise<void>;
}

export const SheetEditorModals: React.FC<SheetEditorModalsProps> = ({
  editingNode,
  setEditingNode,
  handleNodeUpdate,
  isSheetPickerOpen,
  setIsSheetPickerOpen,
  handleImportSheet,
  currentSheet,
  isUsageModalOpen,
  setIsUsageModalOpen,
  handleImportInputs,
  isVersionListOpen,
  setIsVersionListOpen,
  handleRestoreVersion,
  handleSetDefault,
  isDirty,
  isHistoryModalOpen,
  setIsHistoryModalOpen,
  nodes,
  isTakeOverModalOpen,
  setIsTakeOverModalOpen,
  lockedByOther,
  takeOver,
}) => {
  return (
    <>
      <NodeInspector
        node={editingNode}
        isOpen={!!editingNode}
        onClose={() => setEditingNode(null)}
        onSave={handleNodeUpdate}
      />
      <SheetPickerModal
        isOpen={isSheetPickerOpen}
        onClose={() => setIsSheetPickerOpen(false)}
        onSelect={handleImportSheet}
      />
      {currentSheet && (
        <SheetUsageModal
          isOpen={isUsageModalOpen}
          onClose={() => setIsUsageModalOpen(false)}
          sheetId={currentSheet.id}
          onImportInputs={handleImportInputs}
        />
      )}
      {currentSheet && (
        <VersionListModal
          isOpen={isVersionListOpen}
          onClose={() => setIsVersionListOpen(false)}
          sheetId={currentSheet.id}
          defaultVersionId={currentSheet.default_version_id}
          onRestore={handleRestoreVersion}
          onSetDefault={handleSetDefault}
          isDirty={isDirty}
        />
      )}
      {currentSheet && (
        <HistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          sheetId={currentSheet.id}
          nodes={nodes}
        />
      )}
      <Modal
        isOpen={isTakeOverModalOpen}
        onClose={() => setIsTakeOverModalOpen(false)}
        title="Confirm Take Over"
        footer={
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}
          >
            <button
              type="button"
              className="btn secondary"
              onClick={() => setIsTakeOverModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              style={{ backgroundColor: '#d32f2f' }}
              onClick={() => {
                takeOver();
                setIsTakeOverModalOpen(false);
              }}
            >
              Confirm Take Over
            </button>
          </div>
        }
      >
        <p>
          Are you sure you want to forcibly take over the lock from{' '}
          <strong>{lockedByOther}</strong>?
        </p>
        <p style={{ marginTop: '10px', color: '#666' }}>
          This may cause the other user to lose their unsaved work. Only proceed
          if you are sure they are no longer editing.
        </p>
      </Modal>
    </>
  );
};
