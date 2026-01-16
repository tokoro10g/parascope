import type React from 'react';
import { useState } from 'react';
import './Modal.css';

interface VersionCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tag: string, description: string) => void;
}

export const VersionCreateModal: React.FC<VersionCreateModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!tag.trim()) {
      alert('Version tag is required');
      return;
    }
    onSave(tag, description);
    setTag('');
    setDescription('');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Create Sheet Version</h2>
        <div className="form-group">
          <label htmlFor="version-tag">Version Tag (e.g. v1.0):</label>
          <input
            id="version-tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="v1.0"
          />
        </div>
        <div className="form-group">
          <label htmlFor="version-desc">Description (Optional):</label>
          <textarea
            id="version-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what changed in this version..."
            rows={4}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="primary">
            Create Version
          </button>
        </div>
      </div>
    </div>
  );
};
