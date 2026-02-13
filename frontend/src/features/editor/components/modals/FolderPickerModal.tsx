import type React from 'react';
import { useEffect, useState } from 'react';
import { api, type Folder } from '../../../../core/api';
import { ItemExplorer } from '../../../dashboard/ItemExplorer';
import { Modal } from '../../../../components/ui/Modal';

interface FolderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folderId: string | undefined) => void;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const foldersData = await api.listFolders();
        setFolders(foldersData);
      } catch (e) {
        console.error(e);
        alert('Failed to load folders');
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
    <>
      <button type="button" onClick={onClose} className="btn">
        Cancel
      </button>
      <button
        type="button"
        onClick={() => onSelect(currentFolderId)}
        className="btn primary"
      >
        Move Here
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Destination Folder"
      footer={footer}
    >
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ItemExplorer
          folders={folders}
          currentFolderId={currentFolderId}
          onFolderClick={(id) => setCurrentFolderId(id)}
          onGoHome={() => setCurrentFolderId(undefined)}
          onUpClick={currentFolderId ? handleUp : undefined}
          emptyMessage="No subfolders."
        />
      )}
    </Modal>
  );
};
