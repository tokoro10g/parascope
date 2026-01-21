import {
  ArrowLeft,
  Folder as FolderIcon,
  Home,
  Search,
  Workflow,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { Folder, SheetSummary } from '../api';
import './ItemExplorer.css';

interface ItemExplorerProps {
  folders: Folder[];
  sheets?: (SheetSummary | any)[];
  currentFolderId?: string;
  onFolderClick?: (folderId: string) => void;
  onSheetClick?: (sheet: any) => void;
  onUpClick?: () => void;
  onGoHome?: () => void;
  renderFolderActions?: (folder: Folder) => React.ReactNode;
  renderSheetActions?: (sheet: any) => React.ReactNode;
  renderSheetExtra?: (sheet: any) => React.ReactNode;
  emptyMessage?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
}

export const ItemExplorer: React.FC<ItemExplorerProps> = ({
  folders,
  sheets = [],
  currentFolderId,
  onFolderClick,
  onSheetClick,
  onUpClick,
  onGoHome,
  renderFolderActions,
  renderSheetActions,
  renderSheetExtra,
  emptyMessage = 'This folder is empty.',
  showSearch = true,
  searchPlaceholder = 'Search by name or ID...',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const query = searchQuery.toLowerCase();

  const filteredFolders = useMemo(() => {
    return folders
      .filter((f) => {
        if (searchQuery) {
          return (
            f.name.toLowerCase().includes(query) ||
            f.id.toLowerCase().includes(query)
          );
        }
        return (
          f.parent_id === currentFolderId || (!f.parent_id && !currentFolderId)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [folders, searchQuery, query, currentFolderId]);

  const filteredSheets = useMemo(() => {
    return sheets
      .filter((s) => {
        if (searchQuery) {
          return (
            s.name.toLowerCase().includes(query) ||
            s.id.toLowerCase().includes(query)
          );
        }
        return (
          s.folder_id === currentFolderId || (!s.folder_id && !currentFolderId)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sheets, searchQuery, query, currentFolderId]);

  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    let currId = currentFolderId;
    while (currId) {
      const folder = folders.find((f) => f.id === currId);
      if (folder) {
        crumbs.unshift(folder);
        currId = folder.parent_id;
      } else {
        break;
      }
    }
    return crumbs;
  }, [folders, currentFolderId]);

  const getItemBreadcrumbs = (parentId?: string | null) => {
    const crumbs = [];
    let currId = parentId;
    while (currId) {
      const folder = folders.find((f) => f.id === currId);
      if (folder) {
        crumbs.unshift(folder.name);
        currId = folder.parent_id;
      } else {
        break;
      }
    }
    return ['Home', ...crumbs].join(' / ');
  };

  return (
    <div className="item-explorer">
      {showSearch && (
        <div className="item-explorer-search-bar">
          <Search size={18} color="var(--text-secondary)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="clear-search"
            >
              &times;
            </button>
          )}
        </div>
      )}

      {!searchQuery && (
        <div className="item-explorer-breadcrumbs">
          <button
            type="button"
            onClick={onGoHome}
            className={`breadcrumb-item ${!currentFolderId ? 'active' : ''}`}
          >
            <Home size={16} /> Home
          </button>
          {breadcrumbs.map((folder, index) => (
            <React.Fragment key={folder.id}>
              <span className="breadcrumb-separator">/</span>
              <button
                type="button"
                onClick={() => onFolderClick?.(folder.id)}
                className={`breadcrumb-item ${
                  index === breadcrumbs.length - 1 ? 'active' : ''
                }`}
              >
                {folder.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="item-explorer-list">
        {!searchQuery && currentFolderId && onUpClick && (
          <button
            type="button"
            className="explorer-item folder-item"
            onClick={onUpClick}
          >
            <div className="explorer-item-info">
              <ArrowLeft size={20} />
              <span className="explorer-item-name">.. (Up)</span>
            </div>
          </button>
        )}

        {filteredFolders.map((folder) => (
          /* biome-ignore lint/a11y/useSemanticElements: interactive actions inside */
          <div
            key={folder.id}
            className="explorer-item folder-item"
            onClick={() => onFolderClick?.(folder.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ')
                onFolderClick?.(folder.id);
            }}
            role="button"
            tabIndex={0}
          >
            <div className="explorer-item-info">
              <FolderIcon size={20} />
              <div className="explorer-item-text">
                <span className="explorer-item-name">{folder.name}</span>
                {searchQuery && (
                  <span className="explorer-item-subtext">
                    {getItemBreadcrumbs(folder.parent_id)}
                  </span>
                )}
              </div>
            </div>
            {renderFolderActions && (
              <div className="explorer-item-actions">
                {renderFolderActions(folder)}
              </div>
            )}
          </div>
        ))}

        {filteredSheets.map((sheet) => (
          /* biome-ignore lint/a11y/useSemanticElements: interactive actions inside */
          <div
            key={sheet.id}
            className={`explorer-item sheet-item ${onSheetClick ? 'clickable' : ''}`}
            onClick={() => onSheetClick?.(sheet)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSheetClick?.(sheet);
            }}
            role="button"
            tabIndex={onSheetClick ? 0 : -1}
          >
            <div className="explorer-item-info">
              <Workflow size={20} />
              <div className="explorer-item-text">
                <div className="explorer-item-name-row">
                  <span className="explorer-item-name">{sheet.name}</span>
                  {renderSheetExtra?.(sheet)}
                </div>
                {searchQuery && (
                  <span className="explorer-item-subtext">
                    {getItemBreadcrumbs(sheet.folder_id)}
                  </span>
                )}
              </div>
            </div>
            <span className="explorer-item-id">{sheet.id}</span>
            {renderSheetActions && (
              <div className="explorer-item-actions">
                {renderSheetActions(sheet)}
              </div>
            )}
          </div>
        ))}

        {filteredSheets.length === 0 && filteredFolders.length === 0 && (
          <p className="explorer-empty-message">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
};
