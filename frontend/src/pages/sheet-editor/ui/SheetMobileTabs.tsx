import { FileText, Hash, Workflow } from 'lucide-react';
import type React from 'react';
import { useSheetEditor } from '../SheetEditorContext';

export const SheetMobileTabs: React.FC = () => {
  const { isMobile, activeTab, setActiveTab } = useSheetEditor();

  if (!isMobile) return null;

  return (
    <div className="tabs-container">
      <button
        type="button"
        className={`tab-button ${activeTab === 'editor' ? 'active' : ''}`}
        onClick={() => setActiveTab('editor')}
      >
        <Workflow size={16} /> Editor
      </button>
      <button
        type="button"
        className={`tab-button ${activeTab === 'variables' ? 'active' : ''}`}
        onClick={() => setActiveTab('variables')}
      >
        <Hash size={16} /> Variables
      </button>
      <button
        type="button"
        className={`tab-button ${activeTab === 'descriptions' ? 'active' : ''}`}
        onClick={() => setActiveTab('descriptions')}
      >
        <FileText size={16} /> Descriptions
      </button>
    </div>
  );
};
