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
  return values.every((v) => {
    if (v === null || v === undefined) return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') {
      if (v === 'inf' || v === '-inf' || v.toLowerCase() === 'nan') return true;
      return !Number.isNaN(parseFloat(v));
    }
    return false;
  });
}

export function createBaseGrid(ctx: StrategyContext) {
  const top = ctx.topMargin + ctx.index * (ctx.gridHeight + ctx.gap);
  return {
    top: `${top}%`,
    height: `${ctx.gridHeight}%`,
    left: 60,
    right: 40,
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
    data: ctx.results.map((r) => String(r.input_value)),
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

export function createMarkArea(ctx: StrategyContext) {
  const { node, theme } = ctx;
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
