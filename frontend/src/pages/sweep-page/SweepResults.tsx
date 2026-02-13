import type { EChartsOption } from 'echarts';
import ReactECharts from 'echarts-for-react';
import { ChartArea, ExternalLink, Table, TriangleAlert } from 'lucide-react';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import type { NodeData, SweepHeader } from '../../core/api';
import { copyToClipboard } from '../../core/utils';
import { Modal } from '../../components/ui/Modal';
import { getSweepChartOption } from '../../features/calculation/sweep-strategies';
import './SweepPage.css';

interface SweepResultsProps {
  sheetName: string;
  sheetId?: string;
  versionId?: string;
  results: any[][] | null;
  metadata?: Record<string, any>[] | null;
  headers: SweepHeader[];
  nodes: NodeData[];
  inputNodeId: string;
  theme: {
    text: string;
    grid: string;
    font: string;
    background: string;
  };
}

export const SweepResults: React.FC<SweepResultsProps> = ({
  sheetName,
  sheetId,
  versionId,
  results,
  metadata,
  headers,
  nodes,
  inputNodeId,
  theme,
}) => {
  const chartRef = useRef<ReactECharts>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

  const errorIndices = useMemo(() => {
    if (!metadata) return [];
    return metadata.map((m, i) => (m.error ? i : -1)).filter((i) => i !== -1);
  }, [metadata]);

  const hasErrors = errorIndices.length > 0;

  const selectedInputLabel =
    nodes.find((n) => n.id === inputNodeId)?.label || 'Input';

  // Prepare ECharts Option
  const echartsOption: EChartsOption = useMemo(() => {
    return getSweepChartOption(
      results,
      headers,
      nodes,
      theme,
      selectedInputLabel,
      metadata,
    );
  }, [results, headers, nodes, theme, selectedInputLabel, metadata]);

  const handleCopyPlot = async () => {
    if (!chartRef.current) return;
    const echartsInstance = chartRef.current.getEchartsInstance();

    // Get background color from computed style
    const backgroundColor =
      getComputedStyle(document.body).backgroundColor || '#ffffff';

    const base64 = echartsInstance.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor,
    });

    const res = await fetch(base64);
    const blob = await res.blob();
    try {
      await navigator.clipboard
        .write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ])
        .then(() => {
          toast.success('Plot copied to clipboard');
        });
    } catch (e) {
      console.error(e);
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    }
  };

  const handleCopyTable = async () => {
    if (!results || results.length === 0 || !headers) return;

    // Create header row: InputName <tab> OutputName1 <tab> OutputName2 ...
    const header = headers.map((h) => h.label).join('\t');

    // Create data rows
    const rows = results.map((row) => {
      return row
        .map((val) => (val === undefined || val === null ? '' : String(val)))
        .join('\t');
    });

    const text = [header, ...rows].join('\n');
    copyToClipboard(text);
  };

  return (
    <main className="sweep-main">
      <div className="sweep-header-row">
        <h2 className="sweep-header sweep-header-title">
          {sheetId ? (
            <Link
              to={
                versionId
                  ? `/sheet/${sheetId}?versionId=${versionId}`
                  : `/sheet/${sheetId}`
              }
              target="_blank"
              rel="noreferrer"
              style={{
                color: 'inherit',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              title="Open Sheet Editor in New Tab"
            >
              {sheetName || 'Loading...'}
              <ExternalLink size={18} />
            </Link>
          ) : (
            sheetName || 'Loading...'
          )}
        </h2>
        {results && (
          <div className="sweep-copy-actions">
            {hasErrors && (
              <button
                type="button"
                onClick={() => setIsErrorModalOpen(true)}
                className="btn secondary sweep-copy-btn"
                title={`${errorIndices.length} points failed. Click for details.`}
                style={{
                  color: '#ff9800',
                  borderColor: '#ff9800',
                  marginRight: '8px',
                  minWidth: 'unset',
                }}
              >
                <TriangleAlert size={16} />
                <span>Calculation issues</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyTable}
              className="btn secondary sweep-copy-btn"
              title="Copy Data Table to Clipboard"
              style={{ minWidth: 'unset' }}
            >
              <Table size={16} /> Copy Data
            </button>
            <button
              type="button"
              onClick={handleCopyPlot}
              className="btn secondary sweep-copy-btn"
              title="Copy Plot Image to Clipboard"
              style={{ minWidth: 'unset' }}
            >
              <ChartArea size={16} /> Copy Plot
            </button>
          </div>
        )}
      </div>

      {results ? (
        <div className="chart-container">
          <ReactECharts
            ref={chartRef}
            option={echartsOption}
            style={{ height: '100%', width: '100%' }}
            theme={undefined} // We pass styles manually
          />
        </div>
      ) : (
        <div className="empty-state">
          <p>Configure inputs and run the sweep to see results.</p>
        </div>
      )}
      <Modal
        isOpen={isErrorModalOpen}
        onClose={() => setIsErrorModalOpen(false)}
        title="Sweep Errors"
      >
        <p style={{ marginBottom: '15px' }}>
          {errorIndices.length} out of {results?.length} points failed to
          calculate correctly.
        </p>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <table className="sweep-error-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Point</th>
                <th style={{ padding: '8px' }}>Error Message</th>
              </tr>
            </thead>
            <tbody>
              {results &&
                errorIndices.map((idx) => {
                  const row = results[idx];
                  if (!row) return null;

                  const inputLabels = headers
                    .map((h, i) => ({ h, i }))
                    .filter((item) => item.h.type === 'input')
                    .map((item) => `${item.h.label}: ${row[item.i]}`)
                    .join('\n');

                  return (
                    <tr key={idx} style={{ borderTop: '1px solid #eee' }}>
                      <td
                        style={{
                          padding: '8px',
                          fontSize: '0.9em',
                          color: 'var(--text-color)',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {inputLabels}
                      </td>
                      <td
                        style={{
                          padding: '8px',
                          fontSize: '0.85em',
                          color: '#d32f2f',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'monospace',
                          wordBreak: 'break-word',
                        }}
                      >
                        {metadata![idx].error}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Modal>
    </main>
  );
};
