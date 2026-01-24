import type { StrategyContext, VisualizationStrategy } from './types';
import {
  createBaseGrid,
  createBaseYAxis,
  createCategoricalXAxis,
  createRangeSeries,
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
    const { results, metadata, id } = ctx;

    const dataWithMeta = results.map((row, i) => {
      const meta = metadata?.[i]?.[id];
      const min = meta?.min !== undefined ? Number(meta.min) : undefined;
      const max = meta?.max !== undefined ? Number(meta.max) : undefined;
      return {
        x: i, // Category index
        y: parseFloat(String(row[colIndex])),
        min,
        max,
      };
    });

    const seriesList: any[] = [];
    const rangeSeries = createRangeSeries(ctx, dataWithMeta, ctx.label, true);

    if (rangeSeries) {
      seriesList.push(rangeSeries);
    }

    seriesList.push({
      name: ctx.label,
      type: 'bar',
      data: dataWithMeta.map((d) => d.y),
      xAxisIndex: ctx.index,
      yAxisIndex: ctx.index,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
    });

    return seriesList;
  }
}
