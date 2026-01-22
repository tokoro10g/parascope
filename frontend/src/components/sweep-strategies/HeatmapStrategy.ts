import type { StrategyContext, VisualizationStrategy } from './types';
import { createBaseGrid } from './utils';

export class HeatmapStrategy implements VisualizationStrategy {
  canHandle(ctx: StrategyContext) {
    // 2D where both inputs are categorical, and output is numeric
    return (
      ctx.is2D && !ctx.isXNumeric && !ctx.isYNumeric && ctx.isOutputNumeric
    );
  }

  getGrid(ctx: StrategyContext) {
    return createBaseGrid(ctx);
  }

  getAxes(ctx: StrategyContext) {
    const { results } = ctx;
    const uniqueX = Array.from(new Set(results.map((row) => String(row[0]))));
    const uniqueY = Array.from(new Set(results.map((row) => String(row[1]))));

    return {
      xAxis: {
        type: 'category',
        data: uniqueX,
        splitArea: { show: true },
        gridIndex: ctx.index,
        name: ctx.headers[0].label,
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { color: ctx.theme.text, show: ctx.showXLabel },
        axisLine: { lineStyle: { color: ctx.theme.text } },
      },
      yAxis: {
        type: 'category',
        data: uniqueY,
        splitArea: { show: true },
        gridIndex: ctx.index,
        name: ctx.headers[1].label,
        axisLabel: { color: ctx.theme.text },
        axisLine: { lineStyle: { color: ctx.theme.text } },
      },
    };
  }

  getSeries(ctx: StrategyContext) {
    const { results, headers, id } = ctx;
    const colIndex = headers.findIndex((h) => h.id === id);

    const uniqueX = Array.from(new Set(results.map((row) => String(row[0]))));
    const uniqueY = Array.from(new Set(results.map((row) => String(row[1]))));

    const data = results.map((row) => {
      const xIdx = uniqueX.indexOf(String(row[0]));
      const yIdx = uniqueY.indexOf(String(row[1]));
      const val = parseFloat(String(row[colIndex]));
      return [xIdx, yIdx, Number.isNaN(val) ? '-' : val];
    });

    return {
      name: ctx.label,
      type: 'heatmap',
      data: data,
      label: {
        show: true,
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
      xAxisIndex: ctx.index,
      yAxisIndex: ctx.index,
    };
  }

  getExtraOptions(ctx: StrategyContext) {
    const { results, headers, id, gridHeight, topMargin, gap, seriesIndex } =
      ctx;
    const colIndex = headers.findIndex((h) => h.id === id);
    const values = results
      .map((row) => parseFloat(String(row[colIndex])))
      .filter((v) => !Number.isNaN(v));

    const minV = values.length > 0 ? Math.min(...values) : 0;
    const maxV = values.length > 0 ? Math.max(...values) : 100;

    const top = topMargin + ctx.index * (gridHeight + gap);

    return {
      visualMap: [
        {
          min: minV,
          max: maxV,
          calculable: true,
          orient: 'vertical',
          right: 10,
          top: `${top}%`,
          height: `${gridHeight}%`,
          textStyle: { color: ctx.theme.text, fontSize: 10 },
          seriesIndex: seriesIndex,
          dimension: 2,
          inRange: {
            color: [
              '#00008F',
              '#0000FF',
              '#007FFF',
              '#00FFFF',
              '#7FFF7F',
              '#FFFF00',
              '#FF7F00',
              '#FF0000',
              '#800000',
            ],
          },
        },
      ],
    };
  }
}
