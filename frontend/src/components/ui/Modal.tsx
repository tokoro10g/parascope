import { X } from 'lucide-react';
import type React from 'react';
import { useModalKeyEvents } from './hooks/useModalKeyEvents';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width,
  maxWidth,
}) => {
  useModalKeyEvents(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: simple modal */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: simple modal */}
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ width: width, maxWidth: maxWidth }}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
};
