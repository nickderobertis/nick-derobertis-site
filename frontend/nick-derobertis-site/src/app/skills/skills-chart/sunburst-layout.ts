export interface PlotlyMargins {
  l: number;
  r: number;
  t: number;
  b: number;
}

export interface SunburstLayout {
  sunburstcolorway?: string[];
  width?: number;
  height?: number;
  title?: string;
  paper_bgcolor?: string;
  plot_bgcolor?: string;
  margin?: PlotlyMargins;
}
