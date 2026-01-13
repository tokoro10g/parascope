import type { EChartsOption } from 'echarts';
import type { SweepResultStep } from '../api';
import { formatHumanReadableValue } from '../utils';

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

export interface ChartTheme {
  text: string;
  grid: string;
  font: string;
  background: string;
}

export const getSweepChartOption = (
  results: SweepResultStep[] | null,
  nodes: any[], // Using any[] for simplicity, or we can import Node type if available
  theme: ChartTheme,
  selectedInputLabel: string,
): EChartsOption => {
  if (!results || results.length === 0) return {};

  const plottedIds = Object.keys(results[0].outputs);
  const count = plottedIds.length;
  const gap = 5; // gap in percent
  const topMargin = 10;
  const bottomMargin = 10;
  const availableHeight = 100 - topMargin - bottomMargin;
  // Height for each grid
  // h * count + gap * (count - 1) = availableHeight
  // h * count = availableHeight - gap * (count - 1)
  const gridHeight =
    count > 1 ? (availableHeight - gap * (count - 1)) / count : availableHeight;

  const grids: any[] = [];
  const xAxes: any[] = [];
  const yAxes: any[] = [];
  const series: any[] = [];

  plottedIds.forEach((id, index) => {
    const node = nodes.find((n) => n.id === id);
    const label = node ? node.label : id;

    // Determine if data is numeric
    const rawValues = results.map((r) => r.outputs[id]);
    const isNumeric = rawValues.every((v) => {
      if (v === null || v === undefined) return true;
      if (typeof v === 'number') return true;
      if (typeof v === 'string') {
        if (v === 'inf' || v === '-inf' || v.toLowerCase() === 'nan') return true;
        return !Number.isNaN(parseFloat(v));
      }
      return false;
    });

    // Layout calculations
    const top = topMargin + index * (gridHeight + gap);

    grids.push({
      top: `${top}%`,
      height: `${gridHeight}%`,
      left: 60,
      right: 40,
      containLabel: true,
    });

    xAxes.push({
      type: 'value',
      name: index === count - 1 ? selectedInputLabel : '', // Only last one gets x label
      nameLocation: 'middle',
      nameGap: 30,
      scale: true,
      gridIndex: index,
      axisLine: { lineStyle: { color: theme.text } },
      axisLabel: {
        color: theme.text,
        show: index === count - 1,
        formatter: (value: number) => formatHumanReadableValue(value.toString()),
      },
      splitLine: { show: true, lineStyle: { color: theme.grid } },
    });

    if (isNumeric) {
      yAxes.push({
        type: 'value',
        name: label, // Y Axis named after the output
        nameLocation: 'end',
        nameGap: 15,
        nameTextStyle: {
          align: 'left',
        },
        scale: true,
        gridIndex: index,
        boundaryGap: ['5%', '5%'],
        axisLine: { lineStyle: { color: theme.text } },
        axisLabel: {
          color: theme.text,
          backgroundColor: theme.background,
          hideOverlap: true,
          inside: true,
          formatter: (value: number) => formatHumanReadableValue(value.toString()),
        },
        splitLine: { show: true, lineStyle: { color: theme.grid } },
      });

      const data = results.map((r) => [
        parseFloat(String(r.input_value)),
        parseFloat(String(r.outputs[id])),
      ]);

      const min =
        node?.data?.min !== undefined && node.data.min !== ''
          ? Number(node.data.min)
          : undefined;
      const max =
        node?.data?.max !== undefined && node.data.max !== ''
          ? Number(node.data.max)
          : undefined;

      const markArea =
        min !== undefined || max !== undefined
          ? {
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
                    name: `${label} Range`,
                    yAxis: min !== undefined ? min : -Infinity,
                  },
                  {
                    yAxis: max !== undefined ? max : Infinity,
                  },
                ],
              ],
            }
          : undefined;

      series.push({
        name: label,
        type: 'line',
        data: data,
        symbolSize: 6,
        showSymbol: true,
        xAxisIndex: index,
        yAxisIndex: index,
        markArea,
      });
    } else {
      // Timeline Chart equivalent using 'custom' series (Profile example)
      yAxes.push({
        type: 'category',
        data: [label], // Single category represented by the label name
        gridIndex: index,
        name: label,
        nameLocation: 'end',
        nameGap: 15,
        nameTextStyle: {
          align: 'left',
        },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          show: false,
        },
      });

      // Compute Segments
      // [categoryIndex, start, end, value]
      const segments: any[] = [];
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
      // Last segment extension
      let finalEnd = currentStart;
      if (results.length > 1) {
        const lastInput = parseFloat(
          String(results[results.length - 1].input_value),
        );
        const secondLastInput = parseFloat(
          String(results[results.length - 2].input_value),
        );
        const lastStep = lastInput - secondLastInput;
        finalEnd = lastInput + lastStep;
      } else {
        finalEnd = currentStart + 1;
      }
      segments.push([0, currentStart, finalEnd, currentVal]);

      series.push({
        type: 'custom',
        name: label,
        renderItem: renderTimelineItem,
        tooltip: {
          show: false,
        },
        encode: {
          x: [1, 2], // Start, End
          y: 0, // Category
          tooltip: [3, 1, 2], // Value, Start, End for tooltip
        },
        data: segments,
        xAxisIndex: index,
        yAxisIndex: index,
      });
    }
  });

  return {
    backgroundColor: theme.background,
    textStyle: {
      fontFamily: theme.font,
      color: theme.text,
    },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: {
        backgroundColor: '#777',
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
      backgroundColor: theme.background,
      textStyle: {
        color: theme.text,
      },
      borderColor: theme.text,
      valueFormatter: (value, _dataIndex) => {
        if (!value && value !== 0) return '-';
        return formatHumanReadableValue(value?.toString());
      },
    },
    legend: {
      bottom: 0,
      textStyle: {
        color: theme.text,
      },
    },
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series: series as any,
  };
};
