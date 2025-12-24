import React, { useEffect, useState } from 'react';
import { api, type Sheet, type Folder } from '../api';

interface SheetPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (sheet: Sheet) => void;
}

export const SheetPickerModal: React.FC<SheetPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [sheets, setSheets] = useState<Sheet[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
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
                api.listFolders()
            ]);
            // @ts-ignore
            setSheets(sheetsData);
            setFolders(foldersData);
        } catch (e) {
            console.error(e);
            alert("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const currentSheets = sheets.filter(s => s.folder_id === currentFolderId || (!s.folder_id && !currentFolderId));
    const currentFolders = folders.filter(f => f.parent_id === currentFolderId || (!f.parent_id && !currentFolderId));

    const handleUp = () => {
        const current = folders.find(f => f.id === currentFolderId);
        setCurrentFolderId(current?.parent_id);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Import Sheet</h2>
                {loading ? (
                    <p>Loading...</p>
                ) : (
                    <div className="sheet-list">
                        {currentFolderId && (
                            <div className="sheet-item folder-item" onClick={handleUp}>
                                <strong>📁 ..</strong>
                            </div>
                        )}
                        {currentFolders.map(folder => (
                            <div key={folder.id} className="sheet-item folder-item" onClick={() => setCurrentFolderId(folder.id)}>
                                <strong>📁 {folder.name}</strong>
                            </div>
                        ))}
                        {currentSheets.map(sheet => (
                            <div key={sheet.id} className="sheet-item" onClick={() => onSelect(sheet)}>
                                <strong>📄 {sheet.name}</strong>
                                <span className="sheet-id">{sheet.id}</span>
                            </div>
                        ))}
                        {currentSheets.length === 0 && currentFolders.length === 0 && (
                            <p>No items in this folder.</p>
                        )}
                    </div>
                )}
                <button onClick={onClose} style={{ marginTop: '20px' }}>Cancel</button>
            </div>
        </div>
    );
};
