import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Trash2 } from 'lucide-react';
import { api, type SheetSummary } from '../api';

export const Dashboard: React.FC = () => {
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadSheets();
  }, []);

  const loadSheets = async () => {
    try {
      const list = await api.listSheets();
      setSheets(list);
    } catch (e) {
      console.error('Failed to load sheets', e);
    }
  };

  const handleCreateSheet = async () => {
    try {
      const sheet = await api.createSheet(`Untitled Sheet ${Date.now()}`);
      navigate(`/sheet/${sheet.id}`);
    } catch (e) {
      console.error(e);
      alert(`Error creating sheet: ${e}`);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.duplicateSheet(id);
      loadSheets();
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
      loadSheets();
    } catch (e: any) {
      console.error(e);
      alert(`Error deleting sheet: ${e.message || e}`);
    }
  };

  return (
    <div className="dashboard">
      <h1>Parascope Dashboard</h1>
      <div className="actions">
        <button onClick={handleCreateSheet}>+ Create New Sheet</button>
      </div>
      <div className="sheet-list">
        {sheets.map((sheet) => (
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
      </div>
    </div>
  );
};
