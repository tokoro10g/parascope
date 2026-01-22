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
    const { results, headers, id, label, node } = ctx;
    const colIndex = headers.findIndex((h) => h.id === id);

    const xUnique = Array.from(new Set(results.map((row) => row[0])));
    const yUnique = Array.from(new Set(results.map((row) => row[1])));
    const xCount = xUnique.length;
    const yCount = yUnique.length;

    const mainSeries = {
      name: label,
      type: 'surface',
      grid3DIndex: ctx.index,
      wireframe: { show: true },
      shading: 'color',
      data: results.map((row) => [
        parseFloat(String(row[0])),
        parseFloat(String(row[1])),
        parseFloat(String(row[colIndex])),
      ]),
      dataShape: [yCount, xCount],
    };

    const extraSeries: any[] = [mainSeries];

    // Reference planes for min/max
    const minZ =
      node?.data?.min !== undefined && node.data.min !== ''
        ? Number(node.data.min)
        : undefined;
    const maxZ =
      node?.data?.max !== undefined && node.data.max !== ''
        ? Number(node.data.max)
        : undefined;

    const xValues = xUnique.map((v) => parseFloat(String(v)));
    const yValues = yUnique.map((v) => parseFloat(String(v)));
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const createPlane = (name: string, z: number, color: string) => ({
      name: `${label} ${name}`,
      type: 'surface',
      grid3DIndex: ctx.index,
      silent: true,
      wireframe: { show: false },
      shading: 'color',
      itemStyle: { color, opacity: 0.2 },
      data: [
        [minX, minY, z],
        [maxX, minY, z],
        [minX, maxY, z],
        [maxX, maxY, z],
      ],
      dataShape: [2, 2],
    });

    if (minZ !== undefined) {
      extraSeries.push(createPlane('Min', minZ, '#ff4d4f'));
    }
    if (maxZ !== undefined) {
      extraSeries.push(createPlane('Max', maxZ, '#ff4d4f'));
    }

    return extraSeries;
  }

  getExtraOptions(ctx: StrategyContext) {
    const {
      results,
      headers,
      id,
      theme,
      index,
      seriesIndex,
      topMargin,
      gridHeight,
      gap,
    } = ctx;
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
          seriesIndex: seriesIndex,
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
          rotateSensitivity: 3,
        },
        light: {
          main: { intensity: 1.2, shadow: true },
          ambient: { intensity: 0.3 },
        },
      },
    };
  }
}
