import { Download, ExternalLink, Share2 } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, type SheetUsage } from '../api';
import './Modal.css';

interface SheetUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetId: string;
  onImportInputs: (inputs: Record<string, string>) => void;
}

export const SheetUsageModal: React.FC<SheetUsageModalProps> = ({
  isOpen,
  onClose,
  sheetId,
  onImportInputs,
}) => {
  const [usages, setUsages] = useState<SheetUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && sheetId) {
      setLoading(true);
      api
        .getSheetUsages(sheetId)
        .then(setUsages)
        .catch((err) => {
          console.error(err);
          toast.error('Failed to load usages');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, sheetId]);

  if (!isOpen) return null;

  const handleImport = async (usage: SheetUsage) => {
    // We use the last node in the path as ID for UI feedback,
    // though the calculation involves the whole path.
    const targetNodeId = usage.node_path[usage.node_path.length - 1].id;
    setImportingId(targetNodeId);

    try {
      // Calculate ROOT sheet
      const response = await api.calculate(usage.parent_sheet_id, {});

      // Traverse down the path to find the specific instance results
      let currentContext = response.results;
      let validPath = true;

      // The path is [RootInstance, MiddleInstance, ..., TargetInstance]
      let targetResult: any = null;

      for (const node of usage.node_path) {
        const nodeId = node.id;
        if (!currentContext || !currentContext[nodeId]) {
          validPath = false;
          break;
        }

        // If this is the last one, it's our target (the leaf instance we care about)
        if (nodeId === usage.node_path[usage.node_path.length - 1].id) {
          targetResult = currentContext[nodeId];
        } else {
          // Dig deeper
          if (currentContext[nodeId].nodes) {
            currentContext = currentContext[nodeId].nodes;
          } else {
            validPath = false;
            break;
          }
        }
      }

      if (!validPath || !targetResult || !targetResult.inputs) {
        toast('Could not trace values for this instance.', { icon: '❌' });
        return;
      }

      const inputs: Record<string, string> = {};
      let count = 0;

      Object.entries(targetResult.inputs).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          inputs[key] = String(val);
          count++;
        }
      });

      if (count > 0) {
        onImportInputs(inputs);
        toast.success(
          `Imported ${count} input values from ${usage.parent_sheet_name}`,
        );
        onClose();
      } else {
        toast('No inputs found.', { icon: 'ℹ️' });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to calculate parent sheet values');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{ maxWidth: '800px', width: '90%' }}
      >
        <h2>Parent Sheets</h2>
        <p>This sheet is used in the following upper-level sheets:</p>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
        ) : usages.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            This sheet is not used in any other sheets.
          </div>
        ) : (
          <div
            className="usage-list"
            style={{ maxHeight: '400px', overflowY: 'auto', margin: '15px 0' }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {usages.map((usage, idx) => {
                  const targetId =
                    usage.node_path[usage.node_path.length - 1].id;
                  const uniqueKey = `${usage.parent_sheet_id}-${targetId}-${idx}`;

                  // Construct breadcrumb string
                  const pathString = usage.node_path
                    .map((n) => n.label)
                    .join(' > ');

                  return (
                    <tr
                      key={uniqueKey}
                      style={{
                        borderBottom: '1px solid var(--border-color-secondary)',
                      }}
                    >
                      <td style={{ padding: '8px' }}>
                        <a
                          href={`/sheet/${usage.parent_sheet_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontWeight: 'bold',
                            color: 'var(--primary-color)',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {usage.parent_sheet_name} <ExternalLink size={12} />
                        </a>
                        {usage.can_import ? (
                          <div
                            style={{
                              fontSize: '0.85em',
                              color: '#666',
                              marginTop: '4px',
                            }}
                          >
                            <span
                              style={{
                                fontFamily: 'monospace',
                                background: '#f0f0f0',
                                padding: '2px 4px',
                                borderRadius: '4px',
                              }}
                            >
                              &gt; {pathString}
                            </span>
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: '0.85em',
                              color: '#888',
                              fontStyle: 'italic',
                              marginTop: '4px',
                            }}
                          >
                            (Requires external inputs)
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '8px',
                          textAlign: 'right',
                          display: 'flex',
                          gap: '8px',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          height: '100%',
                        }}
                      >
                        {usage.can_import && (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.9em' }}
                            onClick={() => handleImport(usage)}
                            title="Calculate Root sheet and import the inputs for this specific instance"
                            disabled={importingId === targetId}
                          >
                            {importingId === targetId ? (
                              'Calculating...'
                            ) : (
                              <>
                                <Download size={14} /> Import Inputs
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
