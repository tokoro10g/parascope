import type React from 'react';
import { Panel, type PanelImperativeHandle } from 'react-resizable-panels';
import type { NodeResult } from '../../../api';
import type { ParascopeNode } from '../../../rete';
import { SheetTable } from '../../sheet-table';

interface SheetTablePanelProps {
  tablePanelRef: React.RefObject<PanelImperativeHandle | null>;
  isMobile: boolean;
  activeTab: 'editor' | 'variables' | 'descriptions';
  setActiveTab: (tab: 'editor' | 'variables' | 'descriptions') => void;
  nodes: ParascopeNode[];
  handleUpdateNodeValue: (nodeId: string, value: string) => void;
  handleSelectNode: (nodeId: string) => void;
  handleCalculate: () => Promise<void>;
  sheetId: string | undefined;
  calculationInputs: Record<string, string>;
  isCalculating: boolean;
  lastResult: Record<string, NodeResult> | null;
}

export const SheetTablePanel: React.FC<SheetTablePanelProps> = ({
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
}) => {
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
