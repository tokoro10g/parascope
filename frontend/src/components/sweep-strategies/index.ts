import type { EChartsOption } from 'echarts';
import type { SweepResultStep } from '../../api';
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
import { checkIsNumeric } from './utils';

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
  results: SweepResultStep[] | null,
  nodes: any[],
  theme: ChartTheme,
  selectedInputLabel: string,
): EChartsOption => {
  if (!results || results.length === 0) return {};

  // 1. Context Preparation
  const plottedIds = Object.keys(results[0].outputs);
  const count = plottedIds.length;

  // Layout Constants
  const gap = 5;
  const topMargin = 10;
  const bottomMargin = 10;
  const availableHeight = 100 - topMargin - bottomMargin;
  const gridHeight =
    count > 1 ? (availableHeight - gap * (count - 1)) / count : availableHeight;

  // Global Data Analysis
  const isXNumeric = checkIsNumeric(results.map((r) => r.input_value));

  // Containers
  const grids: any[] = [];
  const xAxes: any[] = [];
  const yAxes: any[] = [];
  const series: any[] = [];

  // 2. Iterate Outputs and Delegate
  plottedIds.forEach((id, index) => {
    const node = nodes.find((n) => n.id === id);
    const label = node ? node.label : id;
    const outputValues = results.map((r) => r.outputs[id]);
    const isOutputNumeric = checkIsNumeric(outputValues);

    const context: StrategyContext = {
      id,
      index,
      label,
      results,
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
      backgroundColor: theme.background,
      textStyle: { color: theme.text },
      borderColor: theme.text,
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
