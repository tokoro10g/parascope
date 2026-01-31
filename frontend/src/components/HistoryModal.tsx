import { CheckCheck } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { type AuditLog, api } from '../api';
import type { ParascopeNode } from '../rete';
import { Modal } from './Modal';
import { ScrollablePanel } from './ScrollablePanel';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetId: string;
  nodes: ParascopeNode[];
  before?: string;
  after?: string;
}

const formatValue = (val: any) => {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const groupHistoryByNode = (history: AuditLog[], nodes: ParascopeNode[]) => {
  const nodeGroups: Record<string, { label: string; changes: any[] }> = {};

  history.forEach((log) => {
    log.delta.forEach((d) => {
      const nodeId = d.node_id || 'new-node';
      const label = d.label || '(Unknown Node)';
      if (!nodeGroups[nodeId]) {
        nodeGroups[nodeId] = { label, changes: [] };
      }
      nodeGroups[nodeId].changes.push({
        ...d,
        user_name: log.user_name,
        timestamp: log.timestamp,
        is_unread: log.is_unread,
      });
    });
  });
  return Object.entries(nodeGroups)
    .filter(([nodeId, _value]) => {
      return nodes.some((n) => n.id === nodeId);
    })
    .map(([_key, value]) => value)
    .sort((a, b) => a.label.localeCompare(b.label));
};

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
        className="btn"
        onClick={handleMarkAsRead}
        disabled={history.length === 0}
      >
        <CheckCheck size={16} style={{ marginRight: 8 }} />
        Mark all seen
      </button>
      <button type="button" className="btn primary" onClick={onClose}>
        Close
      </button>
    </div>
  );
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit History"
      footer={footer}
      maxWidth="600px"
    >
      <div style={{ height: '60vh', display: 'flex', flexDirection: 'column' }}>
        <ScrollablePanel dependencies={[history, nodes]}>
          {isLoading ? (
            <div className="history-empty">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="history-empty">No changes recorded yet</div>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {groupHistoryByNode(history, nodes).map((group) => (
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
                        <div className="history-timeline-meta overflow-anywhere">
                          <span className="history-user">
                            {change.user_name}
                          </span>
                          <span className="history-time">
                            {new Date(change.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="history-timeline-delta overflow-anywhere">
                          <span className="delta-field">{change.field}</span>
                          <span className="delta-values">
                            {formatValue(change.old)} →{' '}
                            {formatValue(change.new)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollablePanel>
      </div>
    </Modal>
  );
};
