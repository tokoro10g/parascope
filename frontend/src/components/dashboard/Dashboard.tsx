import {
  Copy,
  Edit2,
  FolderInput,
  FolderPlus,
  Link as LinkIcon,
  LogOut,
  Trash2,
  Workflow,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type Folder, type Session, type SheetSummary } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { DeleteConfirmationModal } from '../DeleteConfirmationModal';
import { FolderPickerModal } from '../FolderPickerModal';
import { ItemExplorer } from '../ItemExplorer';
import { ParascopeLogo } from '../ParascopeLogo';
import './Dashboard.css';

export const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 1000),
  );

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export const Dashboard: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const dataLoadedRef = React.useRef(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(
    folderId,
  );
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [sheetToMove, setSheetToMove] = useState<string | null>(null);

  // Deletion state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    name: string;
    type: 'sheet' | 'folder';
  } | null>(null);

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const loadData = useCallback(async () => {
    try {
      const [sheetsData, foldersData, sessionsData] = await Promise.all([
        api.listSheets(),
        api.listFolders(),
        api.getSessions(),
      ]);
      setSheets(sheetsData);
      setFolders(foldersData);
      setSessions(sessionsData);
    } catch (e) {
      console.error('Failed to load data', e);
      toast.error('Failed to load dashboard data');
    }
  }, []);

  useEffect(() => {
    setCurrentFolderId(folderId);
    const folder = folders.find((f) => f.id === folderId);
    document.title = `${folder?.name || 'Home'} - Parascope`;
  }, [folderId, folders]);

  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;
    loadData();
  }, [loadData]);

  useEffect(() => {
    const refreshSessions = async () => {
      try {
        const sessionsData = await api.getSessions();
        setSessions(sessionsData);
      } catch (e) {
        // Silently fail on background refresh
        console.error('Failed to refresh sessions', e);
      }
    };

    const interval = setInterval(refreshSessions, 10_000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateSheet = async () => {
    try {
      const sheet = await api.createSheet(
        `Untitled Sheet ${Date.now()}`,
        currentFolderId,
      );
      toast.success('Sheet created successfully');
      navigate(`/sheet/${sheet.id}`);
    } catch (e) {
      console.error(e);
      toast.error(`Error creating sheet: ${e}`);
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt('Folder Name:');
    if (name) {
      try {
        await api.createFolder(name, currentFolderId);
        toast.success('Folder created successfully');
        loadData();
      } catch (e) {
        console.error(e);
        toast.error('Failed to create folder');
      }
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.duplicateSheet(id);
      toast.success('Sheet duplicated successfully');
      loadData();
    } catch (e: any) {
      console.error(e);
      toast.error(`Error duplicating sheet: ${e.message || e}`);
    }
  };

  const handleCopyLink = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/sheet/${id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    setItemToDelete({ id, name, type: 'sheet' });
    setDeleteModalOpen(true);
  };

  const handleDeleteFolderClick = (
    e: React.MouseEvent,
    id: string,
    name: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setItemToDelete({ id, name, type: 'folder' });
    setDeleteModalOpen(true);
  };

  const handleRenameFolder = async (
    e: React.MouseEvent,
    id: string,
    currentName: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const newName = prompt('Enter new folder name:', currentName);
    if (newName && newName !== currentName) {
      try {
        await api.updateFolder(id, { name: newName });
        toast.success('Folder renamed successfully');
        loadData();
      } catch (e: any) {
        console.error(e);
        toast.error(`Error renaming folder: ${e.message || e}`);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'sheet') {
        await api.deleteSheet(itemToDelete.id);
        toast.success('Sheet deleted successfully');
      } else {
        await api.deleteFolder(itemToDelete.id);
        toast.success('Folder deleted successfully');
      }
      loadData();
    } catch (e: any) {
      console.error(e);
      toast.error(`Error deleting ${itemToDelete.type}: ${e.message || e}`);
    } finally {
      setDeleteModalOpen(false);
      setItemToDelete(null);
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
        toast.success('Sheet moved successfully');
        loadData();
      } catch (e) {
        console.error(e);
        toast.error('Failed to move sheet');
      }
    }
    setMoveModalOpen(false);
    setSheetToMove(null);
  };

  const getSheetUrl = (sheet: SheetSummary | { id: string; default_version_id?: string | null }) => {
    if (sheet.default_version_id) {
      return `/sheet/${sheet.id}?versionId=${sheet.default_version_id}`;
    }
    return `/sheet/${sheet.id}`;
  };

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
      <div className="dashboard-inner">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
          className="dashboard-header"
        >
          <div className="dashboard-logo-container">
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

        <ItemExplorer
          folders={folders}
          sheets={sheets}
          currentFolderId={currentFolderId}
          onFolderClick={(id) => navigate(`/folder/${id}`)}
          onSheetClick={(sheet) => navigate(getSheetUrl(sheet))}
          onUpClick={currentFolderId ? handleUp : undefined}
          onGoHome={() => navigate('/')}
          renderFolderActions={(folder) => (
            <>
              <button
                type="button"
                onClick={(e) => handleRenameFolder(e, folder.id, folder.name)}
                title="Rename Folder"
                className="btn"
              >
                <Edit2 size={16} />
              </button>
              <button
                type="button"
                onClick={(e) =>
                  handleDeleteFolderClick(e, folder.id, folder.name)
                }
                title="Delete Folder"
                className="btn danger"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
          renderSheetActions={(sheet) => (
            <>
              <button
                type="button"
                onClick={(e) => handleCopyLink(e, sheet.id)}
                title="Copy Sharable Link"
                className="btn"
              >
                <LinkIcon size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => handleMoveClick(e, sheet.id)}
                title="Move to Folder"
                className="btn"
              >
                <FolderInput size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => handleDuplicate(e, sheet.id)}
                title="Duplicate"
                className="btn"
              >
                <Copy size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteClick(e, sheet.id, sheet.name)}
                title="Delete"
                className="btn danger"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
          renderSheetExtra={(sheet) =>
            sheet.has_updates ? (
              <span
                className="update-indicator"
                title="New updates available"
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#007bff',
                  borderRadius: '50%',
                  marginLeft: '8px',
                  display: 'inline-block',
                  boxShadow: '0 0 4px rgba(0,123,255,0.5)',
                }}
              />
            ) : null
          }
        />

        <div className="actions-bottom">
          <button type="button" onClick={handleCreateSheet} className="btn">
            + Create New Sheet
          </button>
          <button type="button" onClick={handleCreateFolder} className="btn">
            <FolderPlus size={16} style={{ marginRight: 5 }} /> New Folder
          </button>
        </div>

        {sessions.length > 0 && (
          <div className="active-sessions-panel" style={{ marginTop: 40 }}>
            <h3>Active Sessions</h3>
            <div className="session-list">
              {sessions.map((s) => (
                <div key={s.sheet_id} className="session-item">
                  <Workflow size={16} style={{ marginRight: 8 }} />
                  <Link to={`/sheet/${s.sheet_id}`} style={{ marginRight: 12 }}>
                    {s.sheet_name}
                  </Link>
                  <span style={{ color: '#666', marginRight: 12 }}>
                    Locked by <strong>{s.user_id}</strong>
                  </span>
                  <span style={{ fontSize: '0.9em', color: '#888' }}>
                    {s.last_save_at
                      ? `Saved ${formatTimeAgo(s.last_save_at)}`
                      : `Started ${formatTimeAgo(s.acquired_at)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <FolderPickerModal
          isOpen={moveModalOpen}
          onClose={() => setMoveModalOpen(false)}
          onSelect={handleMoveSelect}
        />

        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          itemName={itemToDelete?.name || ''}
          itemType={itemToDelete?.type || 'sheet'}
          warningMessage={
            itemToDelete?.type === 'folder'
              ? 'Sheets inside will be moved to the parent.'
              : undefined
          }
        />
      </div>
    </div>
  );
};
