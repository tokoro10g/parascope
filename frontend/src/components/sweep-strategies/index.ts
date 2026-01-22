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

  const count = outputHeaders.length;

  // Layout Constants (for 1D charts primarily)
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
      if (grid && grid.show !== false) grids.push(grid);

      // Axes
      const axes = strategy.getAxes(context);
      if (axes.xAxis) xAxes.push(axes.xAxis);
      if (axes.yAxis) yAxes.push(axes.yAxis);

      // Collect 3D axes into extraOptions (they are root level)
      if (axes.xAxis3D) extraOptions.xAxis3D = axes.xAxis3D;
      if (axes.yAxis3D) extraOptions.yAxis3D = axes.yAxis3D;
      if (axes.zAxis3D) extraOptions.zAxis3D = axes.zAxis3D;

      // Series
      const s = strategy.getSeries(context);
      if (Array.isArray(s)) {
        series.push(...s);
      } else {
        series.push(s);
      }

      // Extra Options (Merge logic)
      if (strategy.getExtraOptions) {
        extraOptions = {
          ...extraOptions,
          ...strategy.getExtraOptions(context),
        };
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
      trigger: is2D ? 'item' : 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: addAlphaToRgb(theme.background, 0.5),
      textStyle: { color: theme.text },
      valueFormatter: (value: any) => {
        if (!value && value !== 0) return '-';
        return formatHumanReadableValue(value?.toString());
      },
      position: (point: any) => [point[0] + 10, '10%'],
    },
    legend: {
      bottom: 0,
      textStyle: { color: theme.text },
    },
    grid: grids.length > 0 ? grids : undefined,
    xAxis: xAxes.length > 0 ? xAxes : undefined,
    yAxis: yAxes.length > 0 ? yAxes : undefined,
    series: series as any[],
    ...extraOptions,
  };
};
