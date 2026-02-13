import type { StrategyContext, VisualizationStrategy } from './types';
import { createBaseGrid, createCategoricalXAxis } from './utils';

export class ScatterStrategy implements VisualizationStrategy {
  canHandle(ctx: StrategyContext) {
    return !ctx.isXNumeric && !ctx.isOutputNumeric;
  }
  getGrid(ctx: StrategyContext) {
    return createBaseGrid(ctx);
  }

  getAxes(ctx: StrategyContext) {
    // Y Axis is dynamic categories from results
    const colIndex = ctx.headers.findIndex((h) => h.id === ctx.id);
    const uniqueY = Array.from(
      new Set(ctx.results.map((row) => String(row[colIndex]))),
    );
    const yAxis = {
      type: 'category',
      data: uniqueY,
      gridIndex: ctx.index,
      name: ctx.label,
      splitLine: { show: false },
      axisLabel: { color: ctx.theme.text },
      axisLine: { lineStyle: { color: ctx.theme.text } },
    };

    return {
      xAxis: createCategoricalXAxis(ctx),
      yAxis,
    };
  }

  getSeries(ctx: StrategyContext) {
    const colIndex = ctx.headers.findIndex((h) => h.id === ctx.id);
    const data = ctx.results.map((row) => [
      String(row[0]),
      String(row[colIndex]),
    ]);
    return {
      type: 'scatter',
      datasetIndex: 0,
      xAxisIndex: ctx.index,
      yAxisIndex: ctx.index,
      data: data,
      symbolSize: 10,
    };
  }
}
