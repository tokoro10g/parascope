import type { StrategyContext, VisualizationStrategy } from './types';

export class Surface3DStrategy implements VisualizationStrategy {
  canHandle(ctx: StrategyContext) {
    return ctx.is2D && ctx.isXNumeric && ctx.isYNumeric && ctx.isOutputNumeric;
  }

  getGrid(_ctx: StrategyContext) {
    // 3D doesn't use standard grid, but we need to return something or handled specially
    return { show: false };
  }

  getAxes(ctx: StrategyContext) {
    const { theme, headers, label } = ctx;
    return {
      xAxis3D: {
        name: headers[0].label,
        type: 'value',
        nameTextStyle: { color: theme.text },
        axisLabel: { textStyle: { color: theme.text } },
        axisLine: { lineStyle: { color: theme.text } },
      },
      yAxis3D: {
        name: headers[1].label,
        type: 'value',
        nameTextStyle: { color: theme.text },
        axisLabel: { textStyle: { color: theme.text } },
        axisLine: { lineStyle: { color: theme.text } },
      },
      zAxis3D: {
        name: label,
        type: 'value',
        nameTextStyle: { color: theme.text },
        axisLabel: { textStyle: { color: theme.text } },
        axisLine: { lineStyle: { color: theme.text } },
      },
    };
  }

  getSeries(ctx: StrategyContext) {
    const { results, headers, id } = ctx;
    const colIndex = headers.findIndex((h) => h.id === id);

    return {
      type: 'surface',
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
    const { results, headers, id } = ctx;
    const colIndex = headers.findIndex((h) => h.id === id);
    const zValues = results.map((row) => parseFloat(String(row[colIndex])));
    const minZ = Math.min(...zValues);
    const maxZ = Math.max(...zValues);

    return {
      visualMap: {
        show: true,
        dimension: 2,
        min: minZ,
        max: maxZ,
        inRange: {
          color: [
            '#313695',
            '#4575b4',
            '#74add1',
            '#abd9e9',
            '#e0f3f8',
            '#ffffbf',
            '#fee090',
            '#fdae61',
            '#f46d43',
            '#d73027',
            '#a50026',
          ],
        },
      },
      grid3D: {
        boxWidth: 100,
        boxDepth: 100,
        viewControl: {
          // rotation and zoom
        },
        light: {
          main: { intensity: 1.2, shadow: true },
          ambient: { intensity: 0.3 },
        },
      },
    };
  }
}
