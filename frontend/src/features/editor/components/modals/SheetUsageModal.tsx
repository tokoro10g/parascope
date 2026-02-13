import { ExternalLink } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, type SheetUsage } from '../../../../core/api';
import { Modal } from '../../../../components/ui/Modal';

interface SheetUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetId: string;
  versionId?: string;
  versionTag?: string;
  onImportInputs: (inputs: Record<string, string>) => void;
}

export const SheetUsageModal: React.FC<SheetUsageModalProps> = ({
  isOpen,
  onClose,
  sheetId,
  versionId,
  versionTag,
  onImportInputs,
}) => {
  const [usages, setUsages] = useState<SheetUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && sheetId) {
      setLoading(true);
      api
        .getSheetUsages(sheetId, versionId)
        .then((data) => {
          // Sort alphabetically by parent sheet name, then by path
          const sorted = [...data].sort((a, b) => {
            const nameCompare = a.parent_sheet_name.localeCompare(
              b.parent_sheet_name,
            );
            if (nameCompare !== 0) return nameCompare;

            const pathA = a.node_path.map((n) => n.label).join(' > ');
            const pathB = b.node_path.map((n) => n.label).join(' > ');
            return pathA.localeCompare(pathB);
          });
          setUsages(sorted);
        })
        .catch((err) => {
          console.error(err);
          toast.error('Failed to load usages');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, sheetId, versionId]);

  if (!isOpen) return null;

  const handleImport = async (usage: SheetUsage) => {
    // We use the last node in the path as ID for UI feedback,
    // though the calculation involves the whole path.
    const targetNodeId = usage.node_path[usage.node_path.length - 1].id;
    setImportingId(targetNodeId);

    try {
      // Calculate ROOT sheet (Draft or Specific Version)
      const response = await api.calculate(
        usage.parent_sheet_id,
        {},
        usage.parent_version_id || undefined,
      );

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

  const footer = (
    <button type="button" onClick={onClose} className="btn">
      Close
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={versionTag ? `Find Usage (${versionTag})` : 'Find Usage (Draft)'}
      footer={footer}
      maxWidth="800px"
    >
      <p>
        This {versionTag ? `version (${versionTag})` : 'draft'} is used in the
        following upper-level sheets:
      </p>
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
                const targetId = usage.node_path[usage.node_path.length - 1].id;
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
                    <td
                      style={{ padding: '8px' }}
                      className="overflow-anywhere"
                    >
                      <a
                        href={`/sheet/${usage.parent_sheet_id}${
                          usage.parent_version_id
                            ? `?versionId=${usage.parent_version_id}`
                            : ''
                        }#${usage.node_path[0].id}`}
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
                        {usage.parent_sheet_name}{' '}
                        <span style={{ fontWeight: 'normal', opacity: 0.8 }}>
                          ({usage.parent_version_tag || 'Draft'})
                        </span>{' '}
                        <ExternalLink size={12} />
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
                          onClick={() => handleImport(usage)}
                          disabled={importingId !== null}
                          className="btn primary"
                        >
                          {importingId === targetId ? '...' : 'Import values'}
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
    </Modal>
  );
};
