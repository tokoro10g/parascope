import { formatHumanReadableValue } from '../../utils';
import type { StrategyContext } from './types';

// Helpers to generate consistent colors for strings
export const strHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++)
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
};

export const getColor = (s: string) => {
  if (!s) return '#ccc';
  const hue = Math.abs(strHash(s)) % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

export const addAlphaToRgb = (rgbString: string, alpha: number) => {
  if (rgbString.startsWith('#')) {
    const r = parseInt(rgbString.substring(1, 3), 16);
    const g = parseInt(rgbString.substring(3, 5), 16);
    const b = parseInt(rgbString.substring(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // "rgb(r, g, b)" or "rgb(r g b)"
  const rgbValues = rgbString.match(/\d+/g);
  if (rgbValues && rgbValues.length === 3) {
    return `rgba(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]}, ${alpha})`;
  }
  // invalid format
  return rgbString;
};

export const renderTimelineItem = (_params: any, api: any) => {
  const categoryIndex = api.value(0);
  const start = api.coord([api.value(1), categoryIndex]);
  const end = api.coord([api.value(2), categoryIndex]);
  const height = api.size([0, 1])[1] * 0.6;

  const rectShape = {
    x: start[0],
    y: start[1] - height / 2,
    width: end[0] - start[0],
    height: height,
  };

  return {
    type: 'group',
    children: [
      {
        type: 'rect',
        shape: rectShape,
        style: {
          fill: getColor(api.value(3) as string),
        },
      },
      {
        type: 'text',
        style: {
          text: api.value(3),
          fill: '#fff',
          textAlign: 'center',
          textVerticalAlign: 'middle',
          x: rectShape.x + rectShape.width / 2,
          y: rectShape.y + rectShape.height / 2,
          width: rectShape.width - 4, // Padding
          overflow: 'truncate',
        },
      },
    ],
  };
};

export function checkIsNumeric(values: any[]) {
  return values.every((rawV) => {
    const v =
      rawV !== null && typeof rawV === 'object' && 'value' in rawV
        ? rawV.value
        : rawV;

    if (v === null || v === undefined || v === '') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed === '') return true;
      if (
        trimmed === 'inf' ||
        trimmed === '-inf' ||
        trimmed.toLowerCase() === 'nan'
      )
        return true;
      // Use Number() for strict parsing (disallows trailing characters like "123 Steel")
      return !Number.isNaN(Number(trimmed));
    }
    return false;
  });
}

export function checkIsCategorical(values: any[]) {
  return !checkIsNumeric(values);
}

export function createBaseGrid(ctx: StrategyContext) {
  const top = ctx.topMargin + ctx.index * (ctx.gridHeight + ctx.gap);
  return {
    top: `${top}%`,
    height: `${ctx.gridHeight}%`,
    left: 60,
    right: 100,
    containLabel: true,
  };
}

export function createBaseXAxis(
  ctx: StrategyContext,
  type: 'value' | 'category',
) {
  return {
    type,
    name: ctx.selectedInputLabel,
    nameLocation: 'middle',
    nameGap: 30,
    scale: true,
    gridIndex: ctx.index,
    axisLine: { lineStyle: { color: ctx.theme.text } },
    axisLabel: {
      color: ctx.theme.text,
      show: ctx.showXLabel,
      formatter:
        type === 'value'
          ? (value: number) => formatHumanReadableValue(value.toString())
          : undefined,
    },
    splitLine: { show: type === 'value', lineStyle: { color: ctx.theme.grid } },
  };
}

export function createCategoricalXAxis(ctx: StrategyContext) {
  return {
    type: 'category',
    data: ctx.results.map((row) => String(row[0])),
    name: ctx.selectedInputLabel,
    nameLocation: 'middle',
    nameGap: 30,
    gridIndex: ctx.index,
    axisLine: { lineStyle: { color: ctx.theme.text } },
    axisLabel: {
      color: ctx.theme.text,
      show: ctx.showXLabel,
      interval: 'auto',
    },
    splitLine: { show: false },
  };
}

export function createBaseYAxis(
  ctx: StrategyContext,
  type: 'value' | 'category',
  scale: boolean,
) {
  return {
    type,
    name: ctx.label,
    nameLocation: 'end',
    nameGap: 15,
    nameTextStyle: { align: 'left' },
    scale,
    gridIndex: ctx.index,
    boundaryGap: ['5%', '5%'],
    axisLine: { lineStyle: { color: ctx.theme.text } },
    axisLabel: {
      color: ctx.theme.text,
      backgroundColor: ctx.theme.background,
      hideOverlap: true,
      inside: true,
      formatter:
        type === 'value'
          ? (value: number) => formatHumanReadableValue(value.toString())
          : undefined,
    },
    splitLine: { show: true, lineStyle: { color: ctx.theme.grid } },
    z: 10,
  };
}

export function createRangeMarkers(ctx: StrategyContext) {
  const { node, theme, metadata, id } = ctx;

  // 1. Dynamic Ranges (MarkLine)
  const dynamicMin = metadata
    ?.map((m) => m[id]?.min)
    .find((v) => v !== undefined);
  const dynamicMax = metadata
    ?.map((m) => m[id]?.max)
    .find((v) => v !== undefined);

  // If we have dynamic range, we don't show static MarkArea (series handles it)
  if (dynamicMin !== undefined || dynamicMax !== undefined) return undefined;

  const min =
    node?.data?.min !== undefined && node.data.min !== ''
      ? Number(node.data.min)
      : undefined;
  const max =
    node?.data?.max !== undefined && node.data.max !== ''
      ? Number(node.data.max)
      : undefined;

  if (min === undefined && max === undefined) return undefined;

  return {
    silent: true,
    itemStyle: {
      color: 'rgba(76, 175, 80, 0.1)',
    },
    label: {
      position: 'insideRight',
      color: theme.text,
    },
    data: [
      [
        {
          name: `${ctx.label} Range`,
          yAxis: min !== undefined ? min : -Infinity,
        },
        {
          yAxis: max !== undefined ? max : Infinity,
        },
      ],
    ],
  };
}

export function createLineSeriesWithRange(
  ctx: StrategyContext,
  data: { x: number; y: number; min?: number; max?: number }[],
  name: string,
) {
  // Sort by X
  data.sort((a, b) => a.x - b.x);

  const lineData = data.map((d) => [d.x, d.y]);
  const hasDynamic = data.some(
    (d) => d.min !== undefined || d.max !== undefined,
  );

  const seriesList: any[] = [];

  // Main Line
  seriesList.push({
    name,
    type: 'line',
    data: lineData,
    symbolSize: 6,
    showSymbol: true,
    xAxisIndex: ctx.index,
    yAxisIndex: ctx.index,
    // Only show static MarkArea if no dynamic range
    markArea: !hasDynamic ? createRangeMarkers(ctx) : undefined,
  });

  // Dynamic Range Band (Custom Series)
  if (hasDynamic) {
    seriesList.push({
      name: `${name} Range`,
      type: 'custom',
      renderItem: (_params: any, api: any) => {
        if (data.length === 0) return;
        const points = [];

        // Build polygon: top edge (max) left-to-right, then bottom edge (min) right-to-left
        for (let i = 0; i < data.length; i++) {
          const d = data[i];
          const topVal = d.max !== undefined ? d.max : 999999999; // Infinity clipped
          const point = api.coord([d.x, topVal]);
          points.push(point);
        }

        for (let i = data.length - 1; i >= 0; i--) {
          const d = data[i];
          const bottomVal = d.min !== undefined ? d.min : -999999999;
          const point = api.coord([d.x, bottomVal]);
          points.push(point);
        }

        return {
          type: 'polygon',
          shape: {
            points: points,
          },
          style: {
            fill: api.visual('color'),
            opacity: 0.05,
            stroke: 'none',
          },
          styleEmphasis: {
            opacity: 0.1,
          },
        };
      },
      data: lineData, // Dummy data for tooltip/color mapping
      z: -1, // Behind the line
      xAxisIndex: ctx.index,
      yAxisIndex: ctx.index,
      tooltip: { show: false }, // Hide range from tooltip
      clip: true,
    });
  }

  return seriesList;
}
