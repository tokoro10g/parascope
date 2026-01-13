import type { VisualizationStrategy, StrategyContext } from './types';
import { createBaseGrid, createCategoricalXAxis } from './utils';

export class ScatterStrategy implements VisualizationStrategy {
    canHandle(ctx: StrategyContext) {
        return !ctx.isXNumeric && !ctx.isOutputNumeric;
    }
    getGrid(ctx: StrategyContext) { return createBaseGrid(ctx); }

    getAxes(ctx: StrategyContext) {
        // Y Axis is dynamic categories from results
        const uniqueY = Array.from(new Set(ctx.results.map(r => String(r.outputs[ctx.id]))));
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
            yAxis
        };
    }

    getSeries(ctx: StrategyContext) {
        const data = ctx.results.map(r => [String(r.input_value), String(r.outputs[ctx.id])]);
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
