import type { StrategyContext, VisualizationStrategy } from './types';
import {
  createBaseGrid,
  createBaseYAxis,
  createCategoricalXAxis,
  createRangeMarkers,
} from './utils';

export class CategoricalBarStrategy implements VisualizationStrategy {
  canHandle(ctx: StrategyContext) {
    return !ctx.is2D && !ctx.isXNumeric && ctx.isOutputNumeric;
  }

  getGrid(ctx: StrategyContext) {
    return createBaseGrid(ctx);
  }

  getAxes(ctx: StrategyContext) {
    return {
      xAxis: createCategoricalXAxis(ctx),
      yAxis: createBaseYAxis(ctx, 'value', false),
    };
  }

  getSeries(ctx: StrategyContext) {
    // For Bar with Category X, logic handles mapping automatically if X axis has data[]
    const colIndex = ctx.headers.findIndex((h) => h.id === ctx.id);
    const data = ctx.results.map((row) => parseFloat(String(row[colIndex])));
    return {
      name: ctx.label,
      type: 'bar',
      data,
      xAxisIndex: ctx.index,
      yAxisIndex: ctx.index,
      markArea: createRangeMarkers(ctx),
      itemStyle: { borderRadius: [4, 4, 0, 0] },
    };
  }
}
