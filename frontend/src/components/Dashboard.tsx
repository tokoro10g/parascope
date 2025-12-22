import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

  return (
    <div className="dashboard">
      <h1>Parascope Dashboard</h1>
      <div className="actions">
        <button onClick={handleCreateSheet}>+ Create New Sheet</button>
      </div>
      <div className="sheet-list">
        {sheets.map((sheet) => (
          <div key={sheet.id} className="sheet-item">
            <Link to={`/sheet/${sheet.id}`}>
              <span className="sheet-name">{sheet.name}</span>
              <span className="sheet-id">{sheet.id}</span>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};
