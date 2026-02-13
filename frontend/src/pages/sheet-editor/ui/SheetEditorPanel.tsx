import type React from 'react';
import { Panel } from 'react-resizable-panels';
import { EditorBar } from '../../../features/editor/components/EditorBar';
import { TooltipLayer } from '../../../components/ui/TooltipLayer';
import { useSheetEditor } from '../SheetEditorContext';

export const SheetEditorPanel: React.FC = () => {
  const {
    editorPanelRef,
    isMobile,
    activeTab,
    isLoading,
    currentSheet,
    isDirty,
    isReadOnly,
    handleRenameSheet,
    handleSave,
    setIsVersionListOpen,
    handleAddNode,
    editor,
    handleCopy,
    handlePaste,
    setIsUsageModalOpen,
    setIsHistoryModalOpen,
    autoCalculate,
    setAutoCalculate,
    reteRef,
  } = useSheetEditor();

  return (
    <Panel
      id="editor-panel"
      panelRef={editorPanelRef}
      defaultSize={isMobile ? (activeTab === 'editor' ? 100 : 0) : 70}
      minSize={isMobile ? 0 : 20}
      style={{
        display: isMobile && activeTab !== 'editor' ? 'none' : 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="rete-container"
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
        {isLoading && <div className="loading-overlay">Loading...</div>}
        {isReadOnly && !isLoading && (
          <div className="readonly-watermark">READ-ONLY</div>
        )}
        <EditorBar
          sheetName={currentSheet?.name}
          isDirty={isDirty}
          readOnly={isReadOnly}
          onRenameSheet={handleRenameSheet}
          onSaveSheet={handleSave}
          onOpenVersionList={() => setIsVersionListOpen(true)}
          onAddNode={handleAddNode}
          onUndo={() => editor?.undo()}
          onRedo={() => editor?.redo()}
          onZoomToFit={() => editor?.zoomToFit()}
          onCopy={() => {
            if (editor) {
              const selected = editor.getSelectedNodes();
              const selectedIds = new Set(selected.map((n) => n.id));
              const nodesData = selected.map((n) => {
                const view = editor.area.nodeViews.get(n.id);
                return {
                  id: n.id,
                  type: n.type,
                  label: n.label,
                  inputs: Object.keys(n.inputs).map((key) => ({
                    key,
                    socket_type: 'any',
                  })),
                  outputs: Object.keys(n.outputs).map((key) => ({
                    key,
                    socket_type: 'any',
                  })),
                  data: JSON.parse(JSON.stringify(n.data)),
                  controls: n.controls.value
                    ? { value: (n.controls.value as any).value }
                    : {},
                  position: view
                    ? { x: view.position.x, y: view.position.y }
                    : { x: 0, y: 0 },
                };
              });

              const internalConnections = editor.instance
                .getConnections()
                .filter(
                  (c) => selectedIds.has(c.source) && selectedIds.has(c.target),
                )
                .map((c) => ({
                  source: c.source,
                  sourceOutput: c.sourceOutput,
                  target: c.target,
                  targetInput: c.targetInput,
                }));

              handleCopy({
                nodes: nodesData,
                connections: internalConnections,
              });
            }
          }}
          onPaste={handlePaste}
          onCheckUsage={() => setIsUsageModalOpen(true)}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          autoCalculate={autoCalculate}
          onToggleAutoCalculate={setAutoCalculate}
        />
        <div
          ref={reteRef}
          className="rete"
          style={{ opacity: isLoading ? 0 : 1 }}
        />
        <TooltipLayer editor={editor} />
      </div>
    </Panel>
  );
};
