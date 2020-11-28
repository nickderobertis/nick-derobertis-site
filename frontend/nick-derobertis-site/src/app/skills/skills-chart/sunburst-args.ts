import { SunburstData } from './sunburst-data';
import { SunburstLayout } from './sunburst-layout';
import { SunburstOptions } from './sunburst-options';

export interface SunburstArgs {
  data: SunburstData[];
  layout: SunburstLayout;
  options?: SunburstOptions;
}
