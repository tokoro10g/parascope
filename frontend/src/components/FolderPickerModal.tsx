import React, { useEffect, useState } from 'react';
import { api, type Folder } from '../api';
import { Folder as FolderIcon, ArrowLeft } from 'lucide-react';

interface FolderPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (folderId: string | undefined) => void;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
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
            const foldersData = await api.listFolders();
            setFolders(foldersData);
        } catch (e) {
            console.error(e);
            alert("Failed to load folders");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const currentFolders = folders.filter(f => f.parent_id === currentFolderId || (!f.parent_id && !currentFolderId));

    const handleUp = () => {
        const current = folders.find(f => f.id === currentFolderId);
        setCurrentFolderId(current?.parent_id);
    };

    const getBreadcrumbs = () => {
        const crumbs = [];
        let currentId = currentFolderId;
        while (currentId) {
            const folder = folders.find(f => f.id === currentId);
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
                <h2>Select Destination Folder</h2>
                
                <div className="breadcrumbs" style={{marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1em'}}>
                    <span 
                        onClick={() => setCurrentFolderId(undefined)} 
                        style={{cursor: 'pointer', color: currentFolderId ? '#007bff' : 'inherit', fontWeight: !currentFolderId ? 'bold' : 'normal'}}
                    >
                        Home
                    </span>
                    {breadcrumbs.map((folder, index) => (
                        <React.Fragment key={folder.id}>
                            <span style={{color: '#999'}}>/</span>
                            <span 
                                onClick={() => setCurrentFolderId(folder.id)} 
                                style={{
                                    cursor: 'pointer', 
                                    color: index === breadcrumbs.length - 1 ? 'inherit' : '#007bff',
                                    fontWeight: index === breadcrumbs.length - 1 ? 'bold' : 'normal'
                                }}
                            >
                                {folder.name}
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
                                <div className="sheet-info">
                                    <ArrowLeft size={20} />
                                    <span className="sheet-name" style={{marginLeft: 10}}>.. (Up)</span>
                                </div>
                            </div>
                        )}
                        {currentFolders.map(folder => (
                            <div key={folder.id} className="sheet-item folder-item" onClick={() => setCurrentFolderId(folder.id)}>
                                <div className="sheet-info">
                                    <FolderIcon size={20} />
                                    <span className="sheet-name" style={{marginLeft: 10}}>{folder.name}</span>
                                </div>
                            </div>
                        ))}
                        {currentFolders.length === 0 && (
                            <p style={{padding: 20, color: '#666'}}>No subfolders.</p>
                        )}
                    </div>
                )}
                <button onClick={() => onSelect(currentFolderId)}>Move to This Folder</button>
                <button onClick={onClose} style={{ marginTop: '20px' }}>Cancel</button>
            </div>
        </div>
    );
};
