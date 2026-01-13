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
  nodes: any[],
  theme: ChartTheme,
  selectedInputLabel: string,
): EChartsOption => {
  if (!results || results.length === 0) return {};

  // 1. Context Preparation
  const plottedIds = Object.keys(results[0].outputs);
  const count = plottedIds.length;
  
  // Layout Constants
  const gap = 5; 
  const topMargin = 10;
  const bottomMargin = 10;
  const availableHeight = 100 - topMargin - bottomMargin;
  const gridHeight = count > 1 ? (availableHeight - gap * (count - 1)) / count : availableHeight;

  // Global Data Analysis
  const isXNumeric = checkIsNumeric(results.map(r => r.input_value));

  // Containers
  const grids: any[] = [];
  const xAxes: any[] = [];
  const yAxes: any[] = [];
  const series: any[] = [];

  // 2. Iterate Outputs and Delegate
  plottedIds.forEach((id, index) => {
    const node = nodes.find((n) => n.id === id);
    const label = node ? node.label : id;
    const outputValues = results.map(r => r.outputs[id]);
    const isOutputNumeric = checkIsNumeric(outputValues);

    const context: StrategyContext = {
      id,
      index,
      label,
      results,
      node,
      theme,
      isXNumeric,
      isOutputNumeric,
      selectedInputLabel: index === count - 1 ? selectedInputLabel : '',
      showXLabel: index === count - 1,
      gridHeight,
      topMargin,
      gap
    };

    // Find Strategy
    const strategy = strategies.find(s => s.canHandle(context));
    
    if (strategy) {
      // Grid
      grids.push(strategy.getGrid(context));
      // Axes
      const axes = strategy.getAxes(context);
      xAxes.push(axes.xAxis);
      yAxes.push(axes.yAxis);
      // Series
      series.push(strategy.getSeries(context));
    } else {
        console.warn(`No strategy found for output ${label}`);
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
      label: { backgroundColor: '#777' },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: theme.background,
      textStyle: { color: theme.text },
      borderColor: theme.text,
      valueFormatter: (value: any) => {
        if (!value && value !== 0) return '-';
        return formatHumanReadableValue(value?.toString());
      },
      position: (point: any) => [point[0] + 10, '10%'],
    },
    legend: {
      bottom: 0,
      textStyle: { color: theme.text },
    },
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series: series,
  };
};

/* --- Plugin System Definitions --- */

interface StrategyContext {
  id: string;
  index: number;
  label: string;
  results: SweepResultStep[];
  node: any;
  theme: ChartTheme;
  isXNumeric: boolean;
  isOutputNumeric: boolean;
  selectedInputLabel: string;
  showXLabel: boolean;
  gridHeight: number;
  topMargin: number;
  gap: number;
}

interface VisualizationStrategy {
  canHandle(ctx: StrategyContext): boolean;
  getGrid(ctx: StrategyContext): any;
  getAxes(ctx: StrategyContext): { xAxis: any; yAxis: any };
  getSeries(ctx: StrategyContext): any;
}

/* --- Concrete Strategies --- */

// 1. Numeric Line Chart (Num -> Num)
class NumericLineStrategy implements VisualizationStrategy {
  canHandle(ctx: StrategyContext) {
    return ctx.isXNumeric && ctx.isOutputNumeric;
  }
  
  getGrid(ctx: StrategyContext) {
    return createBaseGrid(ctx);
  }

  getAxes(ctx: StrategyContext) {
    return {
      xAxis: createBaseXAxis(ctx, 'value'),
      yAxis: createBaseYAxis(ctx, 'value', true)
    };
  }

  getSeries(ctx: StrategyContext) {
    const data = ctx.results.map((r) => [
        parseFloat(String(r.input_value)),
        parseFloat(String(r.outputs[ctx.id])),
    ]);
    return {
      name: ctx.label,
      type: 'line',
      data,
      symbolSize: 6,
      showSymbol: true,
      xAxisIndex: ctx.index,
      yAxisIndex: ctx.index,
      markArea: createMarkArea(ctx),
    };
  }
}

// 2. Categorical Bar Chart (Cat -> Num)
class CategoricalBarStrategy implements VisualizationStrategy {
    canHandle(ctx: StrategyContext) {
      return !ctx.isXNumeric && ctx.isOutputNumeric;
    }
    
    getGrid(ctx: StrategyContext) { return createBaseGrid(ctx); }
  
    getAxes(ctx: StrategyContext) {
      return {
        xAxis: createCategoricalXAxis(ctx),
        yAxis: createBaseYAxis(ctx, 'value', false)
      };
    }
  
    getSeries(ctx: StrategyContext) {
      // For Bar with Category X, logic handles mapping automatically if X axis has data[]
      const data = ctx.results.map((r) => parseFloat(String(r.outputs[ctx.id])));
      return {
        name: ctx.label,
        type: 'bar',
        data,
        xAxisIndex: ctx.index,
        yAxisIndex: ctx.index,
        markArea: createMarkArea(ctx),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      };
    }
}

// 3. Timeline Chart (Num -> Cat)
class TimelineStrategy implements VisualizationStrategy {
    canHandle(ctx: StrategyContext) {
      return ctx.isXNumeric && !ctx.isOutputNumeric;
    }
    getGrid(ctx: StrategyContext) { return createBaseGrid(ctx); }
  
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
        yAxis
      };
    }
  
    getSeries(ctx: StrategyContext) {
      // Compute Segments
      const segments: any[] = [];
      const { results, id } = ctx;
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
      
      // Final Segment Logic
      let finalEnd = currentStart;
       if (results.length > 1) {
            const lastInput = parseFloat(String(results[results.length - 1].input_value));
            const secondLastInput = parseFloat(String(results[results.length - 2].input_value));
            finalEnd = lastInput + (lastInput - secondLastInput);
       } else {
            finalEnd = currentStart + 1; 
       }
       segments.push([0, currentStart, finalEnd, currentVal]);

       return {
            type: 'custom',
            name: ctx.label,
            renderItem: renderTimelineItem,
            tooltip: { show: false },
            encode: { x: [1, 2], y: 0, tooltip: [3, 1, 2] },
            data: segments,
            xAxisIndex: ctx.index,
            yAxisIndex: ctx.index,
       };
    }
}

// 4. Scatter Strategy (Cat -> Cat)
class ScatterStrategy implements VisualizationStrategy {
    canHandle(ctx: StrategyContext) {
        return !ctx.isXNumeric && !ctx.isOutputNumeric;
    }
    getGrid(ctx: StrategyContext) { return createBaseGrid(ctx); }

    getAxes(ctx: StrategyContext) {
        // Y Axis is dynamic categories from results
        const uniqueY = Array.from(new Set(ctx.results.map(r => String(r.outputs[ctx.id]))));
        const yAxis = {
             type: 'category',
             data: uniqueY,
             gridIndex: ctx.index,
             name: ctx.label,
             splitLine: { show: false },
             axisLabel: { color: ctx.theme.text },
             axisLine: { lineStyle: { color: ctx.theme.text } },
        };

        return {
            xAxis: createCategoricalXAxis(ctx),
            yAxis
        };
    }

    getSeries(ctx: StrategyContext) {
        const data = ctx.results.map(r => [String(r.input_value), String(r.outputs[ctx.id])]);
        return {
              type: 'scatter',
              datasetIndex: 0,
              xAxisIndex: ctx.index,
              yAxisIndex: ctx.index,
              data: data,
              symbolSize: 10,
        };
    }
}

// Registry
const strategies: VisualizationStrategy[] = [
    new NumericLineStrategy(),
    new CategoricalBarStrategy(),
    new TimelineStrategy(),
    new ScatterStrategy()
];


/* --- Internal Utilities --- */

function checkIsNumeric(values: any[]) {
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

function createBaseGrid(ctx: StrategyContext) {
    const top = ctx.topMargin + ctx.index * (ctx.gridHeight + ctx.gap);
    return {
      top: `${top}%`,
      height: `${ctx.gridHeight}%`,
      left: 60,
      right: 40,
      containLabel: true,
    };
}

function createBaseXAxis(ctx: StrategyContext, type: 'value' | 'category') {
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
          formatter: type === 'value' ? (value: number) => formatHumanReadableValue(value.toString()) : undefined,
        },
        splitLine: { show: type === 'value', lineStyle: { color: ctx.theme.grid } },
    };
}

function createCategoricalXAxis(ctx: StrategyContext) {
    return {
        type: 'category',
        data: ctx.results.map(r => String(r.input_value)),
        name: ctx.selectedInputLabel, 
        nameLocation: 'middle',
        nameGap: 30,
        gridIndex: ctx.index,
        axisLine: { lineStyle: { color: ctx.theme.text } },
        axisLabel: {
          color: ctx.theme.text,
          show: ctx.showXLabel,
          rotate: 45,
          interval: 'auto',
        },
        splitLine: { show: false },
    };
}

function createBaseYAxis(ctx: StrategyContext, type: 'value' | 'category', scale: boolean) {
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
          formatter: type === 'value' ? (value: number) => formatHumanReadableValue(value.toString()) : undefined,
        },
        splitLine: { show: true, lineStyle: { color: ctx.theme.grid } },
    }
}

function createMarkArea(ctx: StrategyContext) {
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
