import React, { useEffect, useState } from 'react';
import { api, type Sheet } from '../api';

interface SheetPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (sheet: Sheet) => void;
}

export const SheetPickerModal: React.FC<SheetPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [sheets, setSheets] = useState<Sheet[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSheets();
        }
    }, [isOpen]);

    const loadSheets = async () => {
        setLoading(true);
        try {
            const data = await api.listSheets();
            // @ts-ignore - listSheets returns SheetSummary[], but we cast to Sheet[] for now or update state type
            setSheets(data as any);
        } catch (e) {
            console.error(e);
            alert("Failed to load sheets");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Import Sheet</h2>
                {loading ? (
                    <p>Loading...</p>
                ) : (
                    <div className="sheet-list">
                        {sheets.map(sheet => (
                            <div key={sheet.id} className="sheet-item" onClick={() => onSelect(sheet)}>
                                <strong>{sheet.name}</strong>
                                <span className="sheet-id">{sheet.id}</span>
                            </div>
                        ))}
                    </div>
                )}
                <button onClick={onClose} style={{ marginTop: '20px' }}>Cancel</button>
            </div>
        </div>
    );
};
