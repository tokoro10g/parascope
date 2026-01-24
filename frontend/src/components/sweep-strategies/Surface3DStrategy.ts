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
    const { theme, headers, label, grid3DIndex } = ctx;
    return {
      xAxis3D: {
        grid3DIndex: grid3DIndex,
        name: headers[0].label,
        type: 'value',
        nameTextStyle: { color: theme.text },
        axisLabel: { textStyle: { color: theme.text } },
        axisLine: { lineStyle: { color: theme.text } },
      },
      yAxis3D: {
        grid3DIndex: grid3DIndex,
        name: headers[1].label,
        type: 'value',
        nameTextStyle: { color: theme.text },
        axisLabel: { textStyle: { color: theme.text } },
        axisLine: { lineStyle: { color: theme.text } },
      },
      zAxis3D: {
        grid3DIndex: grid3DIndex,
        name: label,
        type: 'value',
        nameTextStyle: { color: theme.text },
        axisLabel: { textStyle: { color: theme.text } },
        axisLine: { lineStyle: { color: theme.text } },
      },
    };
  }

  getSeries(ctx: StrategyContext) {
    const { results, headers, id, grid3DIndex, label } = ctx;
    const colIndex = headers.findIndex((h) => h.id === id);

    const xUnique = Array.from(new Set(results.map((row) => row[0])));
    const yUnique = Array.from(new Set(results.map((row) => row[1])));
    const xCount = xUnique.length;
    const yCount = yUnique.length;

    const mainSeries = {
      name: label,
      type: 'surface',
      grid3DIndex: grid3DIndex,
      wireframe: { show: true },
      shading: 'color',
      data: results.map((row) => {
        const val = row[colIndex];
        return [
          parseFloat(String(row[0])),
          parseFloat(String(row[1])),
          val !== null && val !== undefined ? parseFloat(String(val)) : null,
        ];
      }),
      dataShape: [yCount, xCount],
    };

    const extraSeries: any[] = [mainSeries];

    // Check for min/max in metadata (Backend ensures this is populated even for static)
    const dynamicMin = ctx.metadata?.map((m) => {
      const v = m[id]?.min;
      return v !== null && v !== undefined ? parseFloat(String(v)) : null;
    });
    const dynamicMax = ctx.metadata?.map((m) => {
      const v = m[id]?.max;
      return v !== null && v !== undefined ? parseFloat(String(v)) : null;
    });

    const hasMin = dynamicMin?.some((v) => v !== null && !Number.isNaN(v));
    const hasMax = dynamicMax?.some((v) => v !== null && !Number.isNaN(v));

    if (hasMin) {
      extraSeries.push({
        name: `${label} Min`,
        type: 'surface',
        grid3DIndex: ctx.grid3DIndex,
        silent: true,
        wireframe: { show: false },
        shading: 'color',
        itemStyle: { color: '#1890ff', opacity: 0.2 },
        data: results.map((row, i) => {
          const z = dynamicMin![i];
          return [
            parseFloat(String(row[0])),
            parseFloat(String(row[1])),
            z !== null && !Number.isNaN(z) ? z : (null as any),
          ];
        }),
        dataShape: [yCount, xCount],
      });
    }

    if (hasMax) {
      extraSeries.push({
        name: `${label} Max`,
        type: 'surface',
        grid3DIndex: ctx.grid3DIndex,
        silent: true,
        wireframe: { show: false },
        shading: 'color',
        itemStyle: { color: '#ff4d4f', opacity: 0.2 },
        data: results.map((row, i) => {
          const z = dynamicMax![i];
          return [
            parseFloat(String(row[0])),
            parseFloat(String(row[1])),
            z !== null && !Number.isNaN(z) ? z : (null as any),
          ];
        }),
        dataShape: [yCount, xCount],
      });
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
    const zValues = results
      .map((row) => {
        const val = row[colIndex];
        return val !== null && val !== undefined
          ? parseFloat(String(val))
          : NaN;
      })
      .filter((v) => !Number.isNaN(v));

    const minZ = zValues.length > 0 ? Math.min(...zValues) : 0;
    const maxZ = zValues.length > 0 ? Math.max(...zValues) : 1;

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
        axisPointer: {
          show: true,
          lineStyle: { color: theme.text },
          label: {
            textStyle: { color: theme.text },
          },
        },
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
