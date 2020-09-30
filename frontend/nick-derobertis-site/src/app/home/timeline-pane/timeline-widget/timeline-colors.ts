import { TimelineColorPair, TIMELINE_COLORS } from './timeline-color-pair';

export class TimelineColors {
  colors: TimelineColorPair[] = TIMELINE_COLORS;

  get timelineColors(): string[] {
    const colors: string[] = [];
    for (const colorPair of this.colors) {
      colors.push(colorPair.background);
    }
    return colors;
  }
}
