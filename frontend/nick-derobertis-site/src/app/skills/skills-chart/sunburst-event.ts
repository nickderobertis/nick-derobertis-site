import { SunburstEventPoint } from './sunburst-point';

export interface SunburstEvent {
  event: MouseEvent;
  points: SunburstEventPoint[];
}
