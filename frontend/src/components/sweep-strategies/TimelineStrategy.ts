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
    const { results, id, headers } = ctx;
    const colIndex = headers.findIndex((h) => h.id === id);

    let currentStart = parseFloat(String(results[0][0]));
    let currentVal = String(results[0][colIndex] ?? '');

    for (let i = 1; i < results.length; i++) {
      const nextVal = String(results[i][colIndex] ?? '');
      const nextInput = parseFloat(String(results[i][0]));

      if (nextVal !== currentVal) {
        segments.push([0, currentStart, nextInput, currentVal]);
        currentStart = nextInput;
        currentVal = nextVal;
      }
    }

    // Final Segment Logic
    let finalEnd = currentStart;
    if (results.length > 1) {
      const lastInput = parseFloat(String(results[results.length - 1][0]));
      const secondLastInput = parseFloat(
        String(results[results.length - 2][0]),
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
      encode: { x: [1, 2], y: 0 },
      data: segments,
      xAxisIndex: ctx.index,
      yAxisIndex: ctx.index,
    };
  }
}
