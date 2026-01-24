import type { StrategyContext, VisualizationStrategy } from './types';
import {
  createBaseGrid,
  createBaseXAxis,
  createBaseYAxis,
  createLineSeriesWithRange,
} from './utils';

export class NumericLineStrategy implements VisualizationStrategy {
  canHandle(ctx: StrategyContext) {
    return !ctx.is2D && ctx.isXNumeric && ctx.isOutputNumeric;
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
    const { results, headers, id, metadata } = ctx;
    const colIndex = headers.findIndex((h) => h.id === id);

    const data = results.map((row, i) => {
      // Extract metadata for this row
      const meta = metadata?.[i]?.[id];
      const min = meta?.min !== undefined ? Number(meta.min) : undefined;
      const max = meta?.max !== undefined ? Number(meta.max) : undefined;

      return {
        x: parseFloat(String(row[0])),
        y: parseFloat(String(row[colIndex])),
        min,
        max,
      };
    });

    return createLineSeriesWithRange(ctx, data, ctx.label);
  }
}
