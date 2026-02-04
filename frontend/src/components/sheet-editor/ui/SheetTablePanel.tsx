import type React from 'react';
import { Panel } from 'react-resizable-panels';
import { SheetTable } from '../../sheet-table';
import { useSheetEditor } from '../SheetEditorContext';

export const SheetTablePanel: React.FC = () => {
  const {
    tablePanelRef,
    isMobile,
    activeTab,
    setActiveTab,
    nodes,
    handleUpdateNodeValue,
    handleSelectNode,
    handleCalculate,
    sheetId,
    calculationInputs,
    isCalculating,
    lastResult,
  } = useSheetEditor();

  return (
    <Panel
      id="table-panel"
      panelRef={tablePanelRef}
      defaultSize={isMobile ? (activeTab !== 'editor' ? 100 : 0) : 30}
      minSize={isMobile ? 0 : 10}
      style={{
        display: isMobile && activeTab === 'editor' ? 'none' : 'flex',
        flexDirection: 'column',
      }}
    >
      <SheetTable
        nodes={nodes}
        onUpdateValue={handleUpdateNodeValue}
        onSelectNode={handleSelectNode}
        onCalculate={handleCalculate}
        onSweep={() => {
          const params = new URLSearchParams();
          if (Object.keys(calculationInputs).length > 0) {
            params.set('overrides', JSON.stringify(calculationInputs));
          }
          const versionId = new URLSearchParams(window.location.search).get(
            'versionId',
          );
          if (versionId) {
            params.set('versionId', versionId);
          }
          window.open(`/sheet/${sheetId}/sweep?${params.toString()}`, '_blank');
        }}
        isCalculating={isCalculating}
        activeTab={activeTab === 'editor' ? 'variables' : (activeTab as any)}
        onTabChange={setActiveTab as any}
        hideTabs={isMobile}
        lastResult={lastResult}
      />
    </Panel>
  );
};
