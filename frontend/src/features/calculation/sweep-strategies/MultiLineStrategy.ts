import type { StrategyContext, VisualizationStrategy } from './types';
import {
  createBaseGrid,
  createBaseXAxis,
  createBaseYAxis,
  createLineSeriesWithRange,
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
    const { headers, isXNumeric } = ctx;
    const numericInput = isXNumeric ? headers[0] : headers[1];

    return {
      xAxis: {
        ...createBaseXAxis(ctx, 'value'),
        name: ctx.showXLabel ? numericInput.label : '',
      },
      yAxis: createBaseYAxis(ctx, 'value', true),
    };
  }

  getSeries(ctx: StrategyContext) {
    const { results, headers, id, isXNumeric, metadata } = ctx;
    const colIndex = headers.findIndex((h) => h.id === id);

    // Identify which column is the categorical one (legend) and which is numeric (X axis)
    const numericColIndex = isXNumeric ? 0 : 1;
    const categoricalColIndex = isXNumeric ? 1 : 0;

    const seriesMap: Record<
      string,
      { x: number; y: number; min?: number; max?: number }[]
    > = {};

    results.forEach((row, rowIndex) => {
      const secondaryVal = String(row[categoricalColIndex]);
      if (!seriesMap[secondaryVal]) {
        seriesMap[secondaryVal] = [];
      }

      // Extract metadata for this row
      const meta = metadata?.[rowIndex]?.[id];
      const min = meta?.min !== undefined ? Number(meta.min) : undefined;
      const max = meta?.max !== undefined ? Number(meta.max) : undefined;

      seriesMap[secondaryVal].push({
        x: parseFloat(String(row[numericColIndex])),
        y: parseFloat(String(row[colIndex])),
        min,
        max,
      });
    });

    const seriesList: any[] = [];

    Object.entries(seriesMap).forEach(([category, data]) => {
      const subSeries = createLineSeriesWithRange(
        ctx,
        data,
        `${ctx.label} (${category})`,
      );
      seriesList.push(...subSeries);
    });

    return seriesList;
  }
}
