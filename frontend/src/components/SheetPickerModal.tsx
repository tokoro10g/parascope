import {
  ArrowLeft,
  FileSpreadsheet,
  Folder as FolderIcon,
  Home,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api, type Folder, type Sheet } from '../api';

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
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  const currentSheets = sheets.filter(
    (s) =>
      s.folder_id === currentFolderId || (!s.folder_id && !currentFolderId),
  );
  const currentFolders = folders.filter(
    (f) =>
      f.parent_id === currentFolderId || (!f.parent_id && !currentFolderId),
  );

  const handleUp = () => {
    const current = folders.find((f) => f.id === currentFolderId);
    setCurrentFolderId(current?.parent_id);
  };

  const getBreadcrumbs = () => {
    const crumbs = [];
    let currentId = currentFolderId;
    while (currentId) {
      const folder = folders.find((f) => f.id === currentId);
      if (folder) {
        crumbs.unshift(folder);
        currentId = folder.parent_id;
      } else {
        break;
      }
    }
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Import Sheet</h2>

        <div
          className="breadcrumbs"
          style={{
            marginBottom: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '1em',
          }}
        >
          <span
            onClick={() => setCurrentFolderId(undefined)}
            style={{
              cursor: 'pointer',
              color: currentFolderId
                ? 'var(--primary-color, #007bff)'
                : 'inherit',
              fontWeight: !currentFolderId ? 'bold' : 'normal',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Home size={16} /> Home
          </span>
          {breadcrumbs.map((folder, index) => (
            <React.Fragment key={folder.id}>
              <span style={{ color: 'var(--text-color-secondary, #999)' }}>
                /
              </span>
              <span
                onClick={() => setCurrentFolderId(folder.id)}
                style={{
                  cursor: 'pointer',
                  color:
                    index === breadcrumbs.length - 1
                      ? 'inherit'
                      : 'var(--primary-color, #007bff)',
                  fontWeight:
                    index === breadcrumbs.length - 1 ? 'bold' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <FolderIcon size={16} /> {folder.name}
              </span>
            </React.Fragment>
          ))}
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="sheet-list">
            {currentFolderId && (
              <div className="sheet-item folder-item" onClick={handleUp}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ArrowLeft size={20} />
                  <strong>.. (Up)</strong>
                </div>
              </div>
            )}
            {currentFolders.map((folder) => (
              <div
                key={folder.id}
                className="sheet-item folder-item"
                onClick={() => setCurrentFolderId(folder.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FolderIcon size={20} />
                  <strong>{folder.name}</strong>
                </div>
              </div>
            ))}
            {currentSheets.map((sheet) => (
              <div
                key={sheet.id}
                className="sheet-item"
                onClick={() => onSelect(sheet)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileSpreadsheet size={20} />
                  <strong>{sheet.name}</strong>
                </div>
                <span className="sheet-id">{sheet.id}</span>
              </div>
            ))}
            {currentSheets.length === 0 && currentFolders.length === 0 && (
              <p>No items in this folder.</p>
            )}
          </div>
        )}
        <button onClick={onClose} style={{ marginTop: '20px' }}>
          Cancel
        </button>
      </div>
    </div>
  );
};
