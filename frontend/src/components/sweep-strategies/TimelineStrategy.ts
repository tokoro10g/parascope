import type { StrategyContext, VisualizationStrategy } from './types';
import { createBaseGrid, createBaseXAxis, renderTimelineItem } from './utils';

export class TimelineStrategy implements VisualizationStrategy {
  canHandle(ctx: StrategyContext) {
    return ctx.isXNumeric && !ctx.isOutputNumeric;
  }
  getGrid(ctx: StrategyContext) {
    return createBaseGrid(ctx);
  }

  getAxes(ctx: StrategyContext) {
    // Y Axis is "Category" but hidden/fixed to 1 item
    const yAxis = {
      type: 'category',
      data: [ctx.label],
      gridIndex: ctx.index,
      name: ctx.label,
      nameLocation: 'end',
      nameGap: 15,
      nameTextStyle: { align: 'left' },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
    };
    return {
      xAxis: createBaseXAxis(ctx, 'value'),
      yAxis,
    };
  }

  getSeries(ctx: StrategyContext) {
    // Compute Segments
    const segments: any[] = [];
    const { results, id } = ctx;
    let currentStart = parseFloat(String(results[0].input_value));
    let currentVal = String(results[0].outputs[id] ?? '');

    for (let i = 1; i < results.length; i++) {
      const nextVal = String(results[i].outputs[id] ?? '');
      const nextInput = parseFloat(String(results[i].input_value));

      if (nextVal !== currentVal) {
        segments.push([0, currentStart, nextInput, currentVal]);
        currentStart = nextInput;
        currentVal = nextVal;
      }
    }

    // Final Segment Logic
    let finalEnd = currentStart;
    if (results.length > 1) {
      const lastInput = parseFloat(
        String(results[results.length - 1].input_value),
      );
      const secondLastInput = parseFloat(
        String(results[results.length - 2].input_value),
      );
      finalEnd = lastInput + (lastInput - secondLastInput);
    } else {
      finalEnd = currentStart + 1;
    }
    segments.push([0, currentStart, finalEnd, currentVal]);

    return {
      type: 'custom',
      name: ctx.label,
      renderItem: renderTimelineItem,
      tooltip: { show: false },
      encode: { x: [1, 2], y: 0, tooltip: [3, 1, 2] },
      data: segments,
      xAxisIndex: ctx.index,
      yAxisIndex: ctx.index,
    };
  }
}
