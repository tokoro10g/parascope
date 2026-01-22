import type { EChartsOption } from 'echarts';
import 'echarts-gl';
import type { SweepHeader } from '../../api';
import { formatHumanReadableValue } from '../../utils';
import { CategoricalBarStrategy } from './CategoricalBarStrategy';
import { HeatmapStrategy } from './HeatmapStrategy';
import { MultiLineStrategy } from './MultiLineStrategy';
import { NumericLineStrategy } from './NumericLineStrategy';
import { ScatterStrategy } from './ScatterStrategy';
import { Surface3DStrategy } from './Surface3DStrategy';
import { TimelineStrategy } from './TimelineStrategy';
import type {
  ChartTheme,
  StrategyContext,
  VisualizationStrategy,
} from './types';
import { addAlphaToRgb, checkIsNumeric } from './utils';

// Re-export shared types for consumers
export type { ChartTheme, StrategyContext, VisualizationStrategy };
export { getColor, strHash } from './utils';

// Registry
const strategies: VisualizationStrategy[] = [
  new Surface3DStrategy(),
  new MultiLineStrategy(),
  new HeatmapStrategy(),
  new NumericLineStrategy(),
  new CategoricalBarStrategy(),
  new TimelineStrategy(),
  new ScatterStrategy(),
];

export const getSweepChartOption = (
  results: any[][] | null,
  headers: SweepHeader[],
  nodes: any[],
  theme: ChartTheme,
  selectedInputLabel: string,
): EChartsOption => {
  if (!results || results.length === 0 || headers.length === 0) return {};

  // 1. Global Data Analysis
  const inputHeaders = headers.filter((h) => h.type === 'input');
  const outputHeaders = headers.filter((h) => h.type === 'output');

  const is2D = inputHeaders.length === 2;
  const isXNumeric = checkIsNumeric(results.map((row) => row[0]));
  const isYNumeric = is2D
    ? checkIsNumeric(results.map((row) => row[1]))
    : false;

  const is3D = is2D && isXNumeric && isYNumeric;
  const isHeatmap = is2D && !isXNumeric && !isYNumeric;

  const count = outputHeaders.length;

  // Layout Constants
  const gap = 5;
  const topMargin = 10;
  const bottomMargin = 10;
  const availableHeight = 100 - topMargin - bottomMargin;
  const gridHeight =
    count > 1 ? (availableHeight - gap * (count - 1)) / count : availableHeight;

  // Containers
  const grids: any[] = [];
  const xAxes: any[] = [];
  const yAxes: any[] = [];
  const series: any[] = [];
  const visualMaps: any[] = [];

  // 3D Specific Containers
  const xAxis3D: any[] = [];
  const yAxis3D: any[] = [];
  const zAxis3D: any[] = [];
  const grid3D: any[] = [];

  let currentSeriesIndex = 0;
  let currentGridIndex = 0;
  let currentGrid3DIndex = 0;

  let extraOptions: any = {};

  // 2. Iterate Outputs and Delegate
  outputHeaders.forEach((header, index) => {
    const id = header.id;
    const node = nodes.find((n) => n.id === id);
    const label = header.label;

    // Find index of this output in the results row
    const colIndex = headers.findIndex((h) => h.id === id);
    const outputValues = results.map((row) => row[colIndex]);
    const isOutputNumeric = checkIsNumeric(outputValues);

    const context: StrategyContext = {
      id,
      index,
      seriesIndex: currentSeriesIndex,
      gridIndex: currentGridIndex,
      grid3DIndex: currentGrid3DIndex,
      label,
      results,
      headers,
      node,
      theme,
      is2D,
      isXNumeric,
      isYNumeric,
      isOutputNumeric,
      selectedInputLabel: index === count - 1 ? selectedInputLabel : '',
      showXLabel: index === count - 1,
      gridHeight,
      topMargin,
      gap,
    };

    // Find Strategy
    const strategy = strategies.find((s) => s.canHandle(context));

    if (strategy) {
      // Grid
      const grid = strategy.getGrid(context);
      if (grid && grid.show !== false) {
        grids.push(grid);
        // Important: strategy only consumes gridIndex if it actually adds a grid
      }

      // Axes
      const axes = strategy.getAxes(context);
      let addedStandardAxis = false;
      let added3DAxis = false;

      if (axes.xAxis) {
        if (Array.isArray(axes.xAxis)) xAxes.push(...axes.xAxis);
        else xAxes.push(axes.xAxis);
        addedStandardAxis = true;
      }
      if (axes.yAxis) {
        if (Array.isArray(axes.yAxis)) yAxes.push(...axes.yAxis);
        else yAxes.push(axes.yAxis);
        addedStandardAxis = true;
      }

      // Collect 3D axes
      if (axes.xAxis3D) {
        xAxis3D.push(axes.xAxis3D);
        added3DAxis = true;
      }
      if (axes.yAxis3D) {
        yAxis3D.push(axes.yAxis3D);
        added3DAxis = true;
      }
      if (axes.zAxis3D) {
        zAxis3D.push(axes.zAxis3D);
        added3DAxis = true;
      }

      if (addedStandardAxis) currentGridIndex++;
      if (added3DAxis) currentGrid3DIndex++;

      // Series
      const s = strategy.getSeries(context);
      if (Array.isArray(s)) {
        series.push(...s);
        currentSeriesIndex += s.length;
      } else {
        series.push(s);
        currentSeriesIndex += 1;
      }

      // Extra Options (Merge logic)
      if (strategy.getExtraOptions) {
        const opts = strategy.getExtraOptions(context);
        if (opts.visualMap) {
          if (Array.isArray(opts.visualMap)) {
            visualMaps.push(...opts.visualMap);
          } else {
            visualMaps.push(opts.visualMap);
          }
          delete opts.visualMap;
        }
        if (opts.grid3D) {
          grid3D.push(opts.grid3D);
          delete opts.grid3D;
        }
        extraOptions = { ...extraOptions, ...opts };
      }
    } else {
      console.warn(`No strategy found for output ${label}`);
    }
  });

  return {
    backgroundColor: theme.background,
    textStyle: {
      fontFamily: theme.font,
      color: theme.text,
    },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { backgroundColor: '#777' },
    },
    tooltip: {
      confine: true,
      trigger: is3D || isHeatmap ? 'item' : 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: addAlphaToRgb(theme.background, 0.8),
      borderColor: theme.grid,
      borderWidth: 1,
      textStyle: { color: theme.text, fontSize: 12 },
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params];
        let res = '';
        items.forEach((item, i) => {
          if (i === 0 && !is2D && item.axisValueLabel) {
            res += `<div style="margin-bottom: 4px; font-weight: bold; border-bottom: 1px solid ${theme.grid}">${item.axisValueLabel}</div>`;
          }
          const val = Array.isArray(item.value)
            ? item.value[item.value.length - 1]
            : item.value;
          const displayVal = formatHumanReadableValue(val?.toString());
          res += `
            <div style="display: flex; align-items: center; gap: 8px;">
              ${item.marker || ''}
              <span style="flex: 1">${item.seriesName || ''}</span>
              <span style="font-weight: bold">${displayVal}</span>
            </div>
          `;
        });
        return res;
      },
    },
    legend: {
      bottom: 0,
      textStyle: { color: theme.text },
    },
    visualMap: visualMaps.length > 0 ? visualMaps : undefined,
    grid: grids.length > 0 ? grids : undefined,
    xAxis: xAxes.length > 0 ? xAxes : undefined,
    yAxis: yAxes.length > 0 ? yAxes : undefined,
    xAxis3D: xAxis3D.length > 0 ? xAxis3D : undefined,
    yAxis3D: yAxis3D.length > 0 ? yAxis3D : undefined,
    zAxis3D: zAxis3D.length > 0 ? zAxis3D : undefined,
    grid3D: grid3D.length > 0 ? grid3D : undefined,
    series: series as any[],
    ...extraOptions,
  };
};
