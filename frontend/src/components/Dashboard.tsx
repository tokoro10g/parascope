import {
  ArrowLeft,
  Copy,
  FileText,
  Folder as FolderIcon,
  FolderInput,
  FolderPlus,
  LogOut,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type Folder, type SheetSummary } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { FolderPickerModal } from './FolderPickerModal';
import { ParascopeLogo } from './ParascopeLogo';

export const Dashboard: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(
    folderId,
  );
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [sheetToMove, setSheetToMove] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const loadData = useCallback(async () => {
    try {
      const [sheetsData, foldersData] = await Promise.all([
        api.listSheets(),
        api.listFolders(),
      ]);
      setSheets(sheetsData);
      setFolders(foldersData);
    } catch (e) {
      console.error('Failed to load data', e);
    }
  }, []);

  useEffect(() => {
    setCurrentFolderId(folderId);
  }, [folderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSheet = async () => {
    try {
      const sheet = await api.createSheet(
        `Untitled Sheet ${Date.now()}`,
        currentFolderId,
      );
      navigate(`/sheet/${sheet.id}`);
    } catch (e) {
      console.error(e);
      alert(`Error creating sheet: ${e}`);
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt('Folder Name:');
    if (name) {
      try {
        await api.createFolder(name, currentFolderId);
        loadData();
      } catch (_e) {
        alert('Failed to create folder');
      }
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.duplicateSheet(id);
      loadData();
    } catch (e: any) {
      console.error(e);
      alert(`Error duplicating sheet: ${e.message || e}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this sheet?')) return;

    try {
      await api.deleteSheet(id);
      loadData();
    } catch (e: any) {
      console.error(e);
      alert(`Error deleting sheet: ${e.message || e}`);
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      !confirm(
        'Are you sure you want to delete this folder? Sheets inside will be moved to the root.',
      )
    )
      return;

    try {
      await api.deleteFolder(id);
      loadData();
    } catch (e: any) {
      console.error(e);
      alert(`Error deleting folder: ${e.message || e}`);
    }
  };

  const handleMoveClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSheetToMove(id);
    setMoveModalOpen(true);
  };

  const handleMoveSelect = async (folderId: string | undefined | null) => {
    if (sheetToMove) {
      try {
        await api.updateSheet(sheetToMove, { folder_id: folderId || null });
        loadData();
      } catch (e) {
        console.error(e);
        alert('Failed to move sheet');
      }
    }
    setMoveModalOpen(false);
    setSheetToMove(null);
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
    if (current?.parent_id) {
      navigate(`/folder/${current.parent_id}`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="dashboard">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ParascopeLogo size={48} strokeColor="var(--text-color, #333)" />
          <h1 style={{ margin: 0 }}>Parascope</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>
            Hello, <b>{user}</b>
          </span>
          <button
            type="button"
            onClick={logout}
            title="Change User"
            className="link-button"
            style={{ color: 'var(--text-color, #333)' }}
          >
            <LogOut size={16} /> Change User
          </button>
        </div>
      </div>
      <div className="actions">
        <button type="button" onClick={handleCreateSheet}>
          + Create New Sheet
        </button>
        <button type="button" onClick={handleCreateFolder}>
          <FolderPlus size={16} style={{ marginRight: 5 }} /> New Folder
        </button>
      </div>

      <div
        className="breadcrumbs"
        style={{
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '1.1em',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            cursor: 'pointer',
            color: currentFolderId ? '#007bff' : 'inherit',
            fontWeight: !currentFolderId ? 'bold' : 'normal',
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
          }}
        >
          Home
        </button>
        {breadcrumbs.map((folder, index) => (
          <React.Fragment key={folder.id}>
            <span style={{ color: '#999' }}>/</span>
            <button
              type="button"
              onClick={() => navigate(`/folder/${folder.id}`)}
              style={{
                cursor: 'pointer',
                color: index === breadcrumbs.length - 1 ? 'inherit' : '#007bff',
                fontWeight:
                  index === breadcrumbs.length - 1 ? 'bold' : 'normal',
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
              }}
            >
              {folder.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="sheet-list">
        {currentFolderId && (
          <button
            type="button"
            className="sheet-item folder-item"
            onClick={handleUp}
            style={{
              width: '100%',
              textAlign: 'left',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            <div className="sheet-info">
              <ArrowLeft size={20} />
              <span className="sheet-name" style={{ marginLeft: 10 }}>
                .. (Up)
              </span>
            </div>
          </button>
        )}

        {currentFolders.map((folder) => (
          /* biome-ignore lint/a11y/useSemanticElements: Cannot use <button> because it contains nested interactive elements */
          <div
            key={folder.id}
            className="sheet-item folder-item"
            onClick={() => navigate(`/folder/${folder.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate(`/folder/${folder.id}`);
              }
            }}
          >
            <div
              className="sheet-info"
              style={{ justifyContent: 'flex-start' }}
            >
              <FolderIcon size={20} />
              <span className="sheet-name" style={{ marginLeft: 10 }}>
                {folder.name}
              </span>
            </div>
            <div className="sheet-actions">
              <button
                type="button"
                onClick={(e) => handleDeleteFolder(e, folder.id)}
                title="Delete Folder"
                className="danger"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {currentSheets.map((sheet) => (
          <div key={sheet.id} className="sheet-item">
            <Link to={`/sheet/${sheet.id}`} className="sheet-link">
              <div className="sheet-info">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <FileText size={20} />
                  <span className="sheet-name" style={{ marginLeft: 10 }}>
                    {sheet.name}
                  </span>
                </div>
                <span className="sheet-id">{sheet.id}</span>
              </div>
            </Link>
            <div className="sheet-actions">
              <button
                type="button"
                onClick={(e) => handleMoveClick(e, sheet.id)}
                title="Move to Folder"
              >
                <FolderInput size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => handleDuplicate(e, sheet.id)}
                title="Duplicate"
              >
                <Copy size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(e, sheet.id)}
                title="Delete"
                className="danger"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {currentSheets.length === 0 && currentFolders.length === 0 && (
          <p style={{ padding: 20, color: '#666' }}>This folder is empty.</p>
        )}
      </div>

      <FolderPickerModal
        isOpen={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        onSelect={handleMoveSelect}
      />
    </div>
  );
};
