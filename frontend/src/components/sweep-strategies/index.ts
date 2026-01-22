import type { EChartsOption } from 'echarts';
import type { SweepHeader } from '../../api';
import { formatHumanReadableValue } from '../../utils';
import { CategoricalBarStrategy } from './CategoricalBarStrategy';
import { NumericLineStrategy } from './NumericLineStrategy';
import { ScatterStrategy } from './ScatterStrategy';
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

  // 1. Context Preparation
  const outputHeaders = headers.filter((h) => h.type === 'output');
  const count = outputHeaders.length;

  // Layout Constants
  const gap = 5;
  const topMargin = 10;
  const bottomMargin = 10;
  const availableHeight = 100 - topMargin - bottomMargin;
  const gridHeight =
    count > 1 ? (availableHeight - gap * (count - 1)) / count : availableHeight;

  // Global Data Analysis
  // First column is always the primary input
  const isXNumeric = checkIsNumeric(results.map((row) => row[0]));

  // Containers
  const grids: any[] = [];
  const xAxes: any[] = [];
  const yAxes: any[] = [];
  const series: any[] = [];

  // 2. Iterate Outputs and Delegate
  outputHeaders.forEach((header, index) => {
    const id = header.id;
    const node = nodes.find((n) => n.id === id);
    const label = header.label;

    // Find index of this output in the results row
    // Column 0 is input, columns 1+ are outputs in headers order
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
      isXNumeric,
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
      grids.push(strategy.getGrid(context));
      // Axes
      const axes = strategy.getAxes(context);
      xAxes.push(axes.xAxis);
      yAxes.push(axes.yAxis);
      // Series
      series.push(strategy.getSeries(context));
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
      trigger: 'axis',
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
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series: series,
  };
};
