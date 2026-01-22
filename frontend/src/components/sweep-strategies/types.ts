import type { SweepHeader } from '../../api';

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
  results: any[][];
  headers: SweepHeader[];
  node: any;
  theme: ChartTheme;
  is2D: boolean;
  isXNumeric: boolean;
  isYNumeric: boolean;
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
  getAxes(ctx: StrategyContext): any; // Can return {xAxis, yAxis} or {xAxis3D, yAxis3D, zAxis3D}
  getSeries(ctx: StrategyContext): any;
  getExtraOptions?(ctx: StrategyContext): any; // For visualMap, grid3D, etc.
}
