import type React from 'react';
import { useEffect, useState } from 'react';
import { Modal } from './Modal';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  itemType: 'sheet' | 'folder';
  warningMessage?: string;
}

export const DeleteConfirmationModal: React.FC<
  DeleteConfirmationModalProps
> = ({ isOpen, onClose, onConfirm, itemName, itemType, warningMessage }) => {
  const [confirmName, setConfirmName] = useState('');

  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) {
      setConfirmName('');
    }
  }, [isOpen]);

  const isMatch = confirmName === itemName;

  const footer = (
    <>
      <button type="button" onClick={onClose} className="btn">
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={!isMatch}
        className="btn danger"
        style={{
          opacity: isMatch ? 1 : 0.5,
          cursor: isMatch ? 'pointer' : 'not-allowed',
        }}
      >
        Delete {itemType === 'sheet' ? 'Sheet' : 'Folder'}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${itemType === 'sheet' ? 'Sheet' : 'Folder'}`}
      footer={footer}
    >
      <div style={{ color: 'var(--text-color)' }}>
        <p style={{ marginBottom: '15px' }}>
          This action <strong>cannot be undone</strong>.
        </p>
        {warningMessage && (
          <p style={{ color: 'var(--danger-color)', marginBottom: '15px' }}>
            {warningMessage}
          </p>
        )}
        <p style={{ marginBottom: '10px' }}>
          Please type <strong>{itemName}</strong> to confirm:
        </p>
        <input
          type="text"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder="Type the name here"
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            boxSizing: 'border-box',
            backgroundColor: 'var(--input-bg)',
            color: 'var(--text-color)',
          }}
        />
      </div>
    </Modal>
  );
};
