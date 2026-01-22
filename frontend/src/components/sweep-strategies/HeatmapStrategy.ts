import type { StrategyContext, VisualizationStrategy } from './types';
import { createBaseGrid, getColor } from './utils';

export class HeatmapStrategy implements VisualizationStrategy {
  canHandle(ctx: StrategyContext) {
    // Handle 2D sweeps that aren't numeric surfaces
    if (!ctx.is2D) return false;

    // Cases for Heatmap:
    // 1. Both inputs are categorical (regardless of output type)
    // 2. Output is categorical (regardless of input types)
    return (!ctx.isXNumeric && !ctx.isYNumeric) || !ctx.isOutputNumeric;
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
    const { results, headers, id, isOutputNumeric } = ctx;
    const colIndex = headers.findIndex((h) => h.id === id);

    const uniqueX = Array.from(new Set(results.map((row) => String(row[0]))));
    const uniqueY = Array.from(new Set(results.map((row) => String(row[1]))));

    let uniqueZ: string[] = [];
    if (!isOutputNumeric) {
      uniqueZ = Array.from(
        new Set(results.map((row) => String(row[colIndex] ?? ''))),
      ).sort();
    }

    const data = results.map((row) => {
      const xIdx = uniqueX.indexOf(String(row[0]));
      const yIdx = uniqueY.indexOf(String(row[1]));
      let val: any;

      if (isOutputNumeric) {
        val = parseFloat(String(row[colIndex]));
        if (Number.isNaN(val)) val = '-';
      } else {
        val = uniqueZ.indexOf(String(row[colIndex] ?? ''));
      }

      return [xIdx, yIdx, val];
    });

    return {
      name: ctx.label,
      type: 'heatmap',
      data: data,
      label: {
        show: true,
        formatter: (params: any) => {
          if (isOutputNumeric) return params.value[2];
          return uniqueZ[params.value[2]];
        },
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
    const {
      results,
      headers,
      id,
      gridHeight,
      topMargin,
      gap,
      seriesIndex,
      isOutputNumeric,
    } = ctx;
    const colIndex = headers.findIndex((h) => h.id === id);

    const top = topMargin + ctx.index * (gridHeight + gap);

    if (isOutputNumeric) {
      const values = results
        .map((row) => parseFloat(String(row[colIndex])))
        .filter((v) => !Number.isNaN(v));

      const minV = values.length > 0 ? Math.min(...values) : 0;
      const maxV = values.length > 0 ? Math.max(...values) : 100;

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

    // Categorical Output
    const uniqueZ = Array.from(
      new Set(results.map((row) => String(row[colIndex] ?? ''))),
    ).sort();

    return {
      visualMap: [
        {
          type: 'piecewise',
          orient: 'vertical',
          right: 10,
          top: `${top}%`,
          height: `${gridHeight}%`,
          textStyle: { color: ctx.theme.text, fontSize: 10 },
          seriesIndex: seriesIndex,
          dimension: 2,
          pieces: uniqueZ.map((val, idx) => ({
            value: idx,
            label: val,
            color: getColor(val),
          })),
        },
      ],
    };
  }
}
