import type { SweepResultStep } from '../../api';

export interface ChartTheme {
  text: string;
  grid: string;
  font: string;
  background: string;
}

export interface StrategyContext {
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

export interface VisualizationStrategy {
  canHandle(ctx: StrategyContext): boolean;
  getGrid(ctx: StrategyContext): any;
  getAxes(ctx: StrategyContext): { xAxis: any; yAxis: any };
  getSeries(ctx: StrategyContext): any;
}
