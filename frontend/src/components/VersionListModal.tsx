import { Milestone, RefreshCw, Star, Trash2 } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, type SheetVersion } from '../api';
import { Modal } from './Modal';

interface VersionListModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetId: string;
  defaultVersionId?: string | null;
  onRestore: (version: SheetVersion) => void;
  onSetDefault: (versionId: string | null) => void;
  readOnly?: boolean;
  isDirty?: boolean;
}

export const VersionListModal: React.FC<VersionListModalProps> = ({
  isOpen,
  onClose,
  sheetId,
  defaultVersionId,
  onRestore,
  onSetDefault,
  readOnly = false,
  isDirty = false,
}) => {
  const [versions, setVersions] = useState<SheetVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.listSheetVersions(sheetId);
      setVersions(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load versions');
    } finally {
      setIsLoading(false);
    }
  }, [sheetId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDirty) {
      toast.error('Please save your changes before creating a new version');
      return;
    }
    if (!newTag.trim()) {
      toast.error('Version tag is required');
      return;
    }

    setIsCreating(true);
    try {
      await api.createSheetVersion(sheetId, newTag, newDescription);
      toast.success(`Version ${newTag} created successfully`);
      setNewTag('');
      setNewDescription('');
      loadVersions(); // Refresh list
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to create version: ${e.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (v: SheetVersion) => {
    if (
      !window.confirm(
        `Are you sure you want to delete version "${v.version_tag}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await api.deleteVersion(sheetId, v.id);
      toast.success(`Version ${v.version_tag} deleted`);
      loadVersions();
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to delete version: ${e.message}`);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, loadVersions]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Version Control">
      {!readOnly && (
        <form
          onSubmit={handleCreate}
          className="version-create-form"
          style={{
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: 'var(--button-secondary-bg)',
            borderRadius: '8px',
            border: '1px solid var(--border-light)',
            opacity: isDirty ? 0.7 : 1,
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: '16px',
              fontSize: '1em',
              color: 'var(--text-color)',
            }}
          >
            Create New Version
          </h3>
          {isDirty && (
            <div
              style={{
                fontSize: '0.85em',
                color: 'var(--danger-color)',
                marginBottom: '12px',
                padding: '8px',
                backgroundColor: 'rgba(var(--danger-color-rgb), 0.1)',
                borderRadius: '4px',
                border: '1px solid var(--danger-color)',
              }}
            >
              Please save your changes before creating a new version.
            </div>
          )}
          <div className="form-group">
            <label htmlFor="version-tag" style={{ color: 'var(--text-color)' }}>
              Version Tag (e.g. v1.0):
            </label>
            <input
              id="version-tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="v1.0"
              disabled={isCreating || isDirty}
              style={{
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-color)',
                border: '1px solid var(--border-color)',
              }}
            />
          </div>
          <div className="form-group">
            <label
              htmlFor="version-desc"
              style={{ color: 'var(--text-color)' }}
            >
              Description (Optional):
            </label>
            <textarea
              id="version-desc"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What changed in this version?"
              disabled={isCreating || isDirty}
              rows={2}
              style={{
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-color)',
                border: '1px solid var(--border-color)',
              }}
            />
          </div>
          <button
            type="submit"
            className="btn primary"
            disabled={isCreating || isDirty || !newTag.trim()}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {isCreating ? 'Creating...' : 'Create Version'}
          </button>
        </form>
      )}

      <div
        className="version-list"
        style={{ maxHeight: '400px', overflowY: 'auto' }}
      >
        <div
          className="version-item"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
	    overflowWrap: 'anywhere',
            alignItems: 'center',
            padding: '12px',
            borderBottom: '1px solid var(--border-light)',
            backgroundColor: !defaultVersionId
              ? 'rgba(var(--primary-color-rgb), 0.1)'
              : 'transparent',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="version-tag"
                style={{ color: 'var(--text-color)', fontWeight: 'bold' }}
              >
                Draft
              </span>

              {!defaultVersionId && (
                <span
                  style={{
                    fontSize: '0.75em',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  DEFAULT
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: '0.85em',
                color: 'var(--text-secondary)',
                marginTop: '4px',
              }}
            >
              The current working state of the sheet.
            </div>
          </div>
          {defaultVersionId && !readOnly && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onSetDefault(null)}
              title="Set Draft as default"
            >
              <Star size={14} /> Set Default
            </button>
          )}
        </div>

        {isLoading ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            Loading versions...
          </div>
        ) : versions.length === 0 ? (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <Milestone
              size={48}
              style={{ opacity: 0.2, marginBottom: '12px' }}
            />
            <br />
            No versions created yet
          </div>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              className="version-item"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
	        overflowWrap: 'anywhere',
                alignItems: 'center',
                padding: '12px',
                borderBottom: '1px solid var(--border-light)',
                backgroundColor:
                  v.id === defaultVersionId
                    ? 'rgba(var(--primary-color-rgb), 0.1)'
                    : 'transparent',
              }}
            >
              <div style={{ flex: 1, marginRight: '16px' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <strong
                    style={{ fontSize: '1.1em', color: 'var(--text-color)' }}
                  >
                    {v.version_tag}
                  </strong>
                  {v.id === defaultVersionId && (
                    <span
                      style={{
                        fontSize: '0.75em',
                        backgroundColor: 'var(--primary-color)',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      DEFAULT
                    </span>
                  )}
                  <span
                    style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}
                  >
                    {new Date(v.created_at).toLocaleDateString()}
                  </span>
                </div>
                {v.description && (
                  <div
                    style={{
                      fontSize: '0.85em',
                      color: 'var(--text-secondary)',
                      marginTop: '4px',
                    }}
                  >
                    {v.description}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!readOnly && (
                  <>
                    {v.id !== defaultVersionId && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onSetDefault(v.id)}
                        title="Set as default version for all users"
                      >
                        <Star size={14} /> Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onRestore(v)}
                      title="Overwrite current sheet with this version"
                    >
                      <RefreshCw size={14} /> Restore
                    </button>
                    {v.id !== defaultVersionId && (
                      <button
                        type="button"
                        className="btn btn-sm danger"
                        onClick={() => handleDelete(v)}
                        title="Delete this version"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
                <a
                  href={`/sheet/${sheetId}?versionId=${v.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm"
                  style={{ textDecoration: 'none' }}
                  title="View this version in a new tab"
                >
                  View
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};
