import type { StrategyContext, VisualizationStrategy } from './types';

export class Surface3DStrategy implements VisualizationStrategy {
  canHandle(ctx: StrategyContext) {
    return ctx.is2D && ctx.isXNumeric && ctx.isYNumeric && ctx.isOutputNumeric;
  }

  getGrid(_ctx: StrategyContext) {
    // 3D doesn't use standard grid, we return {show: false} to avoid standard grid logic
    return { show: false };
  }

  getAxes(ctx: StrategyContext) {
    const { theme, headers, label, index } = ctx;
    return {
      xAxis3D: {
        grid3DIndex: index,
        name: headers[0].label,
        type: 'value',
        nameTextStyle: { color: theme.text },
        axisLabel: { textStyle: { color: theme.text } },
        axisLine: { lineStyle: { color: theme.text } },
      },
      yAxis3D: {
        grid3DIndex: index,
        name: headers[1].label,
        type: 'value',
        nameTextStyle: { color: theme.text },
        axisLabel: { textStyle: { color: theme.text } },
        axisLine: { lineStyle: { color: theme.text } },
      },
      zAxis3D: {
        grid3DIndex: index,
        name: label,
        type: 'value',
        nameTextStyle: { color: theme.text },
        axisLabel: { textStyle: { color: theme.text } },
        axisLine: { lineStyle: { color: theme.text } },
      },
    };
  }

  getSeries(ctx: StrategyContext) {
    const { results, headers, id, index, label } = ctx;
    const colIndex = headers.findIndex((h) => h.id === id);

    return {
      name: label,
      type: 'surface',
      grid3DIndex: index,
      wireframe: { show: true },
      data: results.map((row) => [
        parseFloat(String(row[0])),
        parseFloat(String(row[1])),
        parseFloat(String(row[colIndex])),
      ]),
      shading: 'color',
    };
  }

  getExtraOptions(ctx: StrategyContext) {
    const { results, headers, id, theme, index, topMargin, gridHeight, gap } =
      ctx;
    const colIndex = headers.findIndex((h) => h.id === id);
    const zValues = results.map((row) => parseFloat(String(row[colIndex])));
    const minZ = Math.min(...zValues);
    const maxZ = Math.max(...zValues);

    const top = topMargin + index * (gridHeight + gap);

    return {
      visualMap: [
        {
          show: true,
          dimension: 2,
          min: minZ,
          max: maxZ,
          seriesIndex: index,
          right: 10,
          top: `${top}%`,
          height: `${gridHeight}%`,
          textStyle: { color: theme.text, fontSize: 10 },
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
      grid3D: {
        boxWidth: 100,
        boxDepth: 100,
        top: `${top - 5}%`, // Offset slightly to center the 3D box
        height: `${gridHeight}%`,
        viewControl: {
          projection: 'orthographic',
        },
        light: {
          main: { intensity: 1.2, shadow: true },
          ambient: { intensity: 0.3 },
        },
      },
    };
  }
}
