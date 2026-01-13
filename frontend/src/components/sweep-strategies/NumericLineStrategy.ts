import type { VisualizationStrategy, StrategyContext } from './types';
import { createBaseGrid, createBaseXAxis, createBaseYAxis, createMarkArea } from './utils';

export class NumericLineStrategy implements VisualizationStrategy {
  canHandle(ctx: StrategyContext) {
    return ctx.isXNumeric && ctx.isOutputNumeric;
  }
  
  getGrid(ctx: StrategyContext) {
    return createBaseGrid(ctx);
  }

  getAxes(ctx: StrategyContext) {
    return {
      xAxis: createBaseXAxis(ctx, 'value'),
      yAxis: createBaseYAxis(ctx, 'value', true)
    };
  }

  getSeries(ctx: StrategyContext) {
    const data = ctx.results.map((r) => [
        parseFloat(String(r.input_value)),
        parseFloat(String(r.outputs[ctx.id])),
    ]);
    return {
      name: ctx.label,
      type: 'line',
      data,
      symbolSize: 6,
      showSymbol: true,
      xAxisIndex: ctx.index,
      yAxisIndex: ctx.index,
      markArea: createMarkArea(ctx),
    };
  }
}
