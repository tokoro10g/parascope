import type { EChartsOption } from 'echarts';
import ReactECharts from 'echarts-for-react';
import { ChartArea, Table } from 'lucide-react';
import type React from 'react';
import { useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import type { NodeData, SweepResultStep } from '../../api';
import { copyToClipboard } from '../../utils';
import { getSweepChartOption } from '../sweep-strategies';
import './SweepPage.css';

interface SweepResultsProps {
  sheetName: string;
  results: SweepResultStep[] | null;
  nodes: NodeData[];
  outputNodeIds: string[];
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
  results,
  nodes,
  outputNodeIds,
  inputNodeId,
  theme,
}) => {
  const chartRef = useRef<ReactECharts>(null);

  const selectedInputLabel =
    nodes.find((n) => n.id === inputNodeId)?.label || 'Input';

  // Prepare ECharts Option
  const echartsOption: EChartsOption = useMemo(() => {
    return getSweepChartOption(results, nodes, theme, selectedInputLabel);
  }, [results, nodes, theme, selectedInputLabel]);

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
    if (!results || results.length === 0) return;

    // Find valid output nodes for header
    const validOutputIds = results[0]?.outputs
      ? Object.keys(results[0].outputs).filter((id) =>
          outputNodeIds.includes(id),
        )
      : [];

    // Create header row: InputName <tab> OutputName1 <tab> OutputName2 ...
    const header = [
      selectedInputLabel,
      ...validOutputIds.map(
        (id) => nodes.find((n) => n.id === id)?.label || id,
      ),
    ].join('\t');

    // Create data rows
    const rows = results.map((step) => {
      const inputVal = step.input_value;
      const outputVals = validOutputIds.map((id) => {
        const val = step.outputs?.[id];
        return val === undefined || val === null ? '' : String(val);
      });
      return [inputVal, ...outputVals].join('\t');
    });

    const text = [header, ...rows].join('\n');
    copyToClipboard(text);
  };

  return (
    <main className="sweep-main">
      <div className="sweep-header-row">
        <h2 className="sweep-header sweep-header-title">
          {sheetName || 'Loading...'}
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
