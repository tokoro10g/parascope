import type React from 'react';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { api, type Folder, type Sheet } from '@/core/api';
import { ItemExplorer } from '@/features/dashboard/ItemExplorer';

interface SheetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sheet: Sheet) => void;
}

export const SheetPickerModal: React.FC<SheetPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [sheetsData, foldersData] = await Promise.all([
          api.listSheets(),
          api.listFolders(),
        ]);
        // @ts-expect-error
        setSheets(sheetsData);
        setFolders(foldersData);
      } catch (e) {
        console.error(e);
        alert('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUp = () => {
    const current = folders.find((f) => f.id === currentFolderId);
    setCurrentFolderId(current?.parent_id);
  };

  const footer = (
    <button type="button" onClick={onClose} className="btn">
      Cancel
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Sheet"
      footer={footer}
    >
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ItemExplorer
          folders={folders}
          sheets={sheets}
          currentFolderId={currentFolderId}
          onFolderClick={(id) => setCurrentFolderId(id)}
          onGoHome={() => setCurrentFolderId(undefined)}
          onUpClick={currentFolderId ? handleUp : undefined}
          onSheetClick={onSelect}
          emptyMessage="No items in this folder."
        />
      )}
    </Modal>
  );
};
