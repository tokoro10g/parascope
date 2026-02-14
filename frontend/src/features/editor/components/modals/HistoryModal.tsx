import { CheckCheck } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { ScrollablePanel } from '@/components/ui/ScrollablePanel';
import { type AuditLog, api } from '@/core/api';
import type { ParascopeNode } from '@/core/rete';
import { DiffValue } from '@/features/diff/components/DiffViewer';
import { groupHistoryByNode } from '@/features/diff/utils/diff';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetId: string;
  nodes: ParascopeNode[];
  before?: string;
  after?: string;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  sheetId,
  nodes,
  before,
  after,
}) => {
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [groupingMode, setGroupingMode] = useState<'node' | 'time'>('node');

  const loadHistory = useCallback(async () => {
    if (!sheetId) return;
    setIsLoading(true);
    try {
      const data = await api.getSheetHistory(sheetId, { before, after });
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [sheetId, before, after]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  const handleMarkAsRead = async () => {
    try {
      await api.markSheetAsRead(sheetId);
      toast.success('All changes marked as seen');
      loadHistory();
    } catch (e) {
      console.error(e);
    }
  };

  const footer = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
      }}
    >
      <button
        type="button"
        className="btn primary"
        onClick={handleMarkAsRead}
        disabled={history.length === 0}
      >
        <CheckCheck size={16} style={{ marginRight: 8 }} />
        Mark all seen
      </button>
      <button type="button" className="btn" onClick={onClose}>
        Close
      </button>
    </div>
  );
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span>Edit History</span>
          <div className="btn-group" style={{ display: 'flex', gap: '2px' }}>
            <button
              type="button"
              className={`btn btn-sm ${groupingMode === 'node' ? 'primary' : ''}`}
              onClick={() => setGroupingMode('node')}
              style={{ fontSize: '0.7rem' }}
            >
              By Node
            </button>
            <button
              type="button"
              className={`btn btn-sm ${groupingMode === 'time' ? 'primary' : ''}`}
              onClick={() => setGroupingMode('time')}
              style={{ fontSize: '0.7rem' }}
            >
              By Time
            </button>
          </div>
        </div>
      }
      footer={footer}
      maxWidth="1000px"
    >
      <div style={{ height: '60vh', display: 'flex', flexDirection: 'column' }}>
        <ScrollablePanel dependencies={[history, nodes, groupingMode]}>
          {isLoading ? (
            <div className="history-empty">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="history-empty">No changes recorded yet</div>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {groupingMode === 'node'
                ? groupHistoryByNode(history, nodes).map((group) => (
                    <div key={group.label} className="history-node-section">
                      <div className="history-node-header">
                        <strong>{group.label}</strong>
                      </div>
                      <div className="history-node-timeline">
                        {group.changes.map((change, i) => (
                          <div
                            key={`${change.timestamp}-${i}`}
                            className={`history-timeline-item ${change.is_unread ? 'unread' : ''}`}
                          >
                            <div className="history-timeline-row">
                              <div className="history-timeline-delta overflow-anywhere">
                                <span className="delta-field">
                                  {change.field}
                                </span>
                                <div className="delta-values">
                                  <DiffValue
                                    oldVal={change.old}
                                    newVal={change.new}
                                  />
                                </div>
                              </div>
                              <div className="history-timeline-meta overflow-anywhere">
                                <span className="history-time">
                                  {new Date(change.timestamp).toLocaleString()}
                                </span>
                                <span className="history-user">
                                  {change.user_name}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                : history.map((log) => {
                    const visibleChanges = log.delta.filter(
                      (d) =>
                        !d.node_id || nodes.some((n) => n.id === d.node_id),
                    );

                    if (visibleChanges.length === 0) return null;

                    return (
                      <div key={log.id} className="history-node-section">
                        <div className="history-node-header">
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              width: '100%',
                            }}
                          >
                            <strong>
                              {new Date(log.timestamp).toLocaleString()}
                            </strong>
                            <span className="history-user">
                              {log.user_name}
                            </span>
                          </div>
                        </div>
                        <div className="history-node-timeline">
                          {visibleChanges.map((change, i) => (
                            <div
                              key={`${log.id}-${i}`}
                              className={`history-timeline-item ${log.is_unread ? 'unread' : ''}`}
                            >
                              <div className="history-timeline-delta overflow-anywhere">
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: '8px',
                                    alignItems: 'baseline',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: 'bold',
                                      fontSize: '0.85rem',
                                    }}
                                  >
                                    {change.label || '(Unknown Node)'}
                                  </span>
                                  <span className="delta-field">
                                    {change.field}
                                  </span>
                                </div>
                                <div className="delta-values">
                                  <DiffValue
                                    oldVal={change.old}
                                    newVal={change.new}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
            </div>
          )}
        </ScrollablePanel>
      </div>
    </Modal>
  );
};
