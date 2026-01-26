import type React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Sheet } from '../../../api';

interface SheetStatusBannerProps {
  isVersionView: boolean;
  lockedByOther: string | null;
  isReadOnly: boolean;
  isLockLoading: boolean;
  currentSheet: Sheet | null;
  defaultVersionTag: string | null;
  sheetId: string | undefined;
  setIsTakeOverModalOpen: (open: boolean) => void;
}

export const SheetStatusBanner: React.FC<SheetStatusBannerProps> = ({
  isVersionView,
  lockedByOther,
  isReadOnly,
  isLockLoading,
  currentSheet,
  defaultVersionTag,
  sheetId,
  setIsTakeOverModalOpen,
}) => {
  const navigate = useNavigate();

  if (isVersionView) {
    return (
      <div
        className="lock-banner"
        style={{
          backgroundColor: '#e3f2fd',
          color: '#0d47a1',
          borderColor: '#90caf9',
        }}
      >
        <span>
          Viewing{' '}
          <strong>
            Version Snapshot ({(currentSheet as any)?.version_tag})
          </strong>
          . Read-Only Mode.
        </span>
        <button
          type="button"
          onClick={() => navigate(`/sheet/${sheetId}`)}
          className="btn"
          style={{
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            minWidth: 'unset',
          }}
        >
          Back to Live
        </button>
      </div>
    );
  }

  if (!lockedByOther && currentSheet?.default_version_id) {
    return (
      <div
        className="lock-banner"
        style={{
          backgroundColor: '#fff3e0',
          color: '#e65100',
          borderColor: '#ffe0b2',
        }}
      >
        <span>
          Status:{' '}
          <strong>Draft (Default is {defaultVersionTag || 'Locked'})</strong>.
          Changes here will not affect other sheets until a new version is
          published and set as default.
        </span>
        <button
          type="button"
          onClick={() =>
            navigate(
              `/sheet/${sheetId}?versionId=${currentSheet.default_version_id}`,
            )
          }
          className="btn"
          style={{
            backgroundColor: '#e65100',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            minWidth: 'unset',
          }}
        >
          View Default
        </button>
      </div>
    );
  }

  if (lockedByOther) {
    return (
      <div className="lock-banner">
        <span>
          Currently being edited by <strong>{lockedByOther}</strong>. You are in
          Read-Only mode.
        </span>
        <button
          type="button"
          onClick={() => setIsTakeOverModalOpen(true)}
          className="btn danger"
          style={{ padding: '5px 10px', minWidth: 'unset' }}
        >
          Take Over
        </button>
      </div>
    );
  }

  if (!lockedByOther && isReadOnly && !isLockLoading) {
    return (
      <div className="lock-banner">
        <span>You are in Read-Only mode. Reload to acquire lock.</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn"
          style={{ padding: '5px 10px', minWidth: 'unset' }}
        >
          Reload
        </button>
      </div>
    );
  }

  return null;
};
