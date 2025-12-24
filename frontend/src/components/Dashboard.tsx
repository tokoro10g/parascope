import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Trash2, Folder as FolderIcon, FolderPlus, ArrowLeft } from 'lucide-react';
import { api, type SheetSummary, type Folder } from '../api';

export const Dashboard: React.FC = () => {
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sheetsData, foldersData] = await Promise.all([
        api.listSheets(),
        api.listFolders()
      ]);
      setSheets(sheetsData);
      setFolders(foldersData);
    } catch (e) {
      console.error('Failed to load data', e);
    }
  };

  const handleCreateSheet = async () => {
    try {
      const sheet = await api.createSheet(`Untitled Sheet ${Date.now()}`, currentFolderId);
      navigate(`/sheet/${sheet.id}`);
    } catch (e) {
      console.error(e);
      alert(`Error creating sheet: ${e}`);
    }
  };

  const handleCreateFolder = async () => {
      const name = prompt("Folder Name:");
      if (name) {
          try {
            await api.createFolder(name, currentFolderId);
            loadData();
          } catch (e) {
              alert("Failed to create folder");
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

  const currentSheets = sheets.filter(s => s.folder_id === currentFolderId || (!s.folder_id && !currentFolderId));
  const currentFolders = folders.filter(f => f.parent_id === currentFolderId || (!f.parent_id && !currentFolderId));

  const handleUp = () => {
      const current = folders.find(f => f.id === currentFolderId);
      setCurrentFolderId(current?.parent_id);
  };

  return (
    <div className="dashboard">
      <h1>Parascope Dashboard</h1>
      <div className="actions">
        <button onClick={handleCreateSheet}>+ Create New Sheet</button>
        <button onClick={handleCreateFolder}><FolderPlus size={16} style={{marginRight: 5}}/> New Folder</button>
      </div>
      
      <div className="sheet-list">
        {currentFolderId && (
            <div className="sheet-item folder-item" onClick={handleUp} style={{cursor: 'pointer', backgroundColor: '#f0f0f0'}}>
                <div className="sheet-info">
                    <ArrowLeft size={20} />
                    <span className="sheet-name" style={{marginLeft: 10}}>.. (Up)</span>
                </div>
            </div>
        )}
        
        {currentFolders.map(folder => (
            <div key={folder.id} className="sheet-item folder-item" onClick={() => setCurrentFolderId(folder.id)} style={{cursor: 'pointer', backgroundColor: '#f8f9fa'}}>
                <div className="sheet-info">
                    <FolderIcon size={20} fill="#FFD700" stroke="#DAA520" />
                    <span className="sheet-name" style={{marginLeft: 10}}>{folder.name}</span>
                </div>
            </div>
        ))}

        {currentSheets.map((sheet) => (
          <div key={sheet.id} className="sheet-item">
            <Link to={`/sheet/${sheet.id}`} className="sheet-link">
              <div className="sheet-info">
                <span className="sheet-name">{sheet.name}</span>
                <span className="sheet-id">{sheet.id}</span>
              </div>
            </Link>
            <div className="sheet-actions">
                <button onClick={(e) => handleDuplicate(e, sheet.id)} title="Duplicate">
                    <Copy size={16} />
                </button>
                <button onClick={(e) => handleDelete(e, sheet.id)} title="Delete" className="danger">
                    <Trash2 size={16} />
                </button>
            </div>
          </div>
        ))}
        
        {currentSheets.length === 0 && currentFolders.length === 0 && (
            <p style={{padding: 20, color: '#666'}}>This folder is empty.</p>
        )}
      </div>
    </div>
  );
};
