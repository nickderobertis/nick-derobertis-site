import { SunburstHoverPoint } from './sunburst-hover-point';

export interface SunburstHoverEvent {
  event: MouseEvent;
  points: SunburstHoverPoint[];
}
