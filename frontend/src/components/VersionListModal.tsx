import { RotateCcw } from 'lucide-react';
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
  isDirty: boolean;
}

export const VersionListModal: React.FC<VersionListModalProps> = ({
  isOpen,
  onClose,
  sheetId,
  defaultVersionId,
  onRestore,
  onSetDefault,
  isDirty,
}) => {
  const [versions, setVersions] = useState<SheetVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!sheetId) return;
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

  const handleCreate = async () => {
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

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, loadVersions]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Version Control">
      {/* Creation Form */}
      <div
        style={{
          marginBottom: '20px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '10px' }}>
          Create New Version
        </h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Tag (e.g. v1.0)"
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
            }}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || isDirty}
            className="btn"
            style={{
              padding: '8px 16px',
              backgroundColor: isDirty
                ? 'var(--text-muted)'
                : 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isCreating || isDirty ? 'not-allowed' : 'pointer',
              opacity: isCreating || isDirty ? 0.7 : 1,
              minWidth: 'unset',
            }}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
        {isDirty && (
          <p
            style={{
              color: 'var(--danger-color)',
              fontSize: '0.85em',
              margin: '5px 0 0 0',
            }}
          >
            Please save your changes before creating a new version.
          </p>
        )}
        <textarea
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />
      </div>

      <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '10px' }}>
        History
      </h3>
      <div
        className="version-list"
        style={{ maxHeight: '50vh', overflowY: 'auto' }}
      >
        <div
          style={{
            padding: '12px',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            backgroundColor: !defaultVersionId
              ? 'rgba(25, 118, 210, 0.1)'
              : 'var(--panel-bg-secondary)',
            marginBottom: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '1.1em' }}>
                Live (Bleeding Edge)
              </strong>
              {!defaultVersionId && (
                <span
                  style={{
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.75em',
                  }}
                >
                  Current Default
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
              The latest saved state.
            </div>
          </div>
          {defaultVersionId && (
            <button
              type="button"
              onClick={() => onSetDefault(null)}
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.85em' }}
            >
              Set as Default
            </button>
          )}
        </div>

        {isLoading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '20px',
              color: 'var(--text-secondary)',
            }}
          >
            Loading versions...
          </div>
        ) : versions.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '20px',
              color: 'var(--text-secondary)',
            }}
          >
            No versions created yet
          </div>
        ) : (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {versions.map((v) => (
              <div
                key={v.id}
                style={{
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  backgroundColor:
                    v.id === defaultVersionId
                      ? 'rgba(25, 118, 210, 0.1)'
                      : 'var(--panel-bg-secondary)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '4px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <strong style={{ fontSize: '1.1em' }}>
                      {v.version_tag}
                    </strong>
                    {v.id === defaultVersionId && (
                      <span
                        style={{
                          backgroundColor: 'var(--primary-color)',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.75em',
                        }}
                      >
                        Default
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '0.85em',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {new Date(v.created_at).toLocaleString()}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '0.9em',
                    marginBottom: '10px',
                    color: 'var(--text-color)',
                  }}
                >
                  {v.description || (
                    <em style={{ color: 'var(--text-secondary)' }}>
                      No description
                    </em>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85em',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>By {v.created_by}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {v.id !== defaultVersionId && (
                      <button
                        type="button"
                        onClick={() => onSetDefault(v.id)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.85em' }}
                      >
                        Set as Default
                      </button>
                    )}
                    <a
                      href={`/sheet/${sheetId}?versionId=${v.id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        textDecoration: 'none',
                        color: 'var(--link-color, #007bff)',
                        border: '1px solid var(--border-color)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--panel-bg)',
                      }}
                    >
                      View
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to restore version "${v.version_tag}"? This will overwrite your current sheet state.`,
                          )
                        ) {
                          onRestore(v);
                          onClose();
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        background: 'var(--panel-bg)',
                        cursor: 'pointer',
                      }}
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
