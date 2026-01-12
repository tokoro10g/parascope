import {
  ArrowLeft,
  Copy,
  Folder as FolderIcon,
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
import { api, type Folder, type Session, type SheetSummary } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { FolderPickerModal } from './FolderPickerModal';
import { ParascopeLogo } from './ParascopeLogo';
import './Dashboard.css';

export const formatTimeAgo = (dateStr: string) => {
  // Backend returns generic UTC timestamp without 'Z'. Ensure it's treated as UTC.
  const time = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
  const date = new Date(time);
  const now = new Date();
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

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
    document.title = `Parascope - ${folder?.name || 'Home'}`;
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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this sheet?')) return;

    try {
      await api.deleteSheet(id);
      toast.success('Sheet deleted successfully');
      loadData();
    } catch (e: any) {
      console.error(e);
      toast.error(`Error deleting sheet: ${e.message || e}`);
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      !confirm(
        'Are you sure you want to delete this folder? Sheets inside will be moved to the parent.',
      )
    )
      return;

    try {
      await api.deleteFolder(id);
      toast.success('Folder deleted successfully');
      loadData();
    } catch (e: any) {
      console.error(e);
      toast.error(`Error deleting folder: ${e.message || e}`);
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
            fontFamily: 'inherit',
            fontSize: 'inherit',
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
                fontFamily: 'inherit',
                fontSize: 'inherit',
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
              <span className="sheet-name">{folder.name}</span>
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
              <div
                className="sheet-info"
                style={{ justifyContent: 'flex-start' }}
              >
                <Workflow size={20} />
                <span className="sheet-name">{sheet.name}</span>
              </div>
            </Link>
            <span className="sheet-id">{sheet.id}</span>
            <div className="sheet-actions">
              <button
                type="button"
                onClick={(e) => handleCopyLink(e, sheet.id)}
                title="Copy Sharable Link"
              >
                <LinkIcon size={16} />
              </button>
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
    </div>
  );
};
