import type { StrategyContext, VisualizationStrategy } from './types';
import {
  createBaseGrid,
  createBaseXAxis,
  createBaseYAxis,
  createMarkArea,
} from './utils';

export class MultiLineStrategy implements VisualizationStrategy {
  canHandle(ctx: StrategyContext) {
    // 2D where one is numeric and another is categorical, and output is numeric
    if (!ctx.is2D || !ctx.isOutputNumeric) return false;

    const oneNumericOneCategorical =
      (ctx.isXNumeric && !ctx.isYNumeric) ||
      (!ctx.isXNumeric && ctx.isYNumeric);

    return oneNumericOneCategorical;
  }

  getGrid(ctx: StrategyContext) {
    return createBaseGrid(ctx);
  }

  getAxes(ctx: StrategyContext) {
    return {
      xAxis: createBaseXAxis(ctx, 'value'),
      yAxis: createBaseYAxis(ctx, 'value', true),
    };
  }

  getSeries(ctx: StrategyContext) {
    const { results, headers, id, isXNumeric } = ctx;
    const colIndex = headers.findIndex((h) => h.id === id);

    // Identify which column is the categorical one (legend) and which is numeric (X axis)
    // results row format: [input1, input2, output1, output2, ...]
    const numericColIndex = isXNumeric ? 0 : 1;
    const categoricalColIndex = isXNumeric ? 1 : 0;

    const seriesMap: Record<string, any[][]> = {};

    results.forEach((row) => {
      const secondaryVal = String(row[categoricalColIndex]);
      if (!seriesMap[secondaryVal]) {
        seriesMap[secondaryVal] = [];
      }
      seriesMap[secondaryVal].push([
        parseFloat(String(row[numericColIndex])),
        parseFloat(String(row[colIndex])),
      ]);
    });

    return Object.entries(seriesMap).map(([category, data]) => ({
      name: `${ctx.label} (${category})`,
      type: 'line',
      data: data.sort((a, b) => a[0] - b[0]),
      symbolSize: 6,
      showSymbol: true,
      xAxisIndex: ctx.index,
      yAxisIndex: ctx.index,
      markArea: createMarkArea(ctx),
    }));
  }
}
