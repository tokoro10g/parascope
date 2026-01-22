import type { EChartsOption } from 'echarts';
import ReactECharts from 'echarts-for-react';
import { ChartArea, Table } from 'lucide-react';
import type React from 'react';
import { useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import type { NodeData, SweepHeader } from '../../api';
import { copyToClipboard } from '../../utils';
import { getSweepChartOption } from '../sweep-strategies';
import './SweepPage.css';

interface SweepResultsProps {
  sheetName: string;
  sheetId?: string;
  results: any[][] | null;
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
  results,
  headers,
  nodes,
  inputNodeId,
  theme,
}) => {
  const chartRef = useRef<ReactECharts>(null);

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
    );
  }, [results, headers, nodes, theme, selectedInputLabel]);

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
              to={`/sheet/${sheetId}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
              title="Open Sheet Editor in New Tab"
            >
              {sheetName || 'Loading...'}
            </Link>
          ) : (
            sheetName || 'Loading...'
          )}
        </h2>
        {results && (
          <div className="sweep-copy-actions">
            <button
              type="button"
              onClick={handleCopyTable}
              className="btn-secondary sweep-copy-btn"
              title="Copy Data Table to Clipboard"
            >
              <Table size={16} className="sweep-copy-icon" /> Copy Data
            </button>
            <button
              type="button"
              onClick={handleCopyPlot}
              className="btn-secondary sweep-copy-btn"
              title="Copy Plot Image to Clipboard"
            >
              <ChartArea size={16} className="sweep-copy-icon" /> Copy Plot
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
    </main>
  );
};
