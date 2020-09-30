import { TimelineColorPair, TIMELINE_COLORS } from './timeline-color-pair';
import { TimelineModel } from './timeline-model';

interface TimelineWithColor {
  timeline: TimelineModel;
  colorIndex: number;
}

export class TimelineColors {
  colors: TimelineColorPair[] = TIMELINE_COLORS;
  registeredTimelines: TimelineWithColor[] = [];

  registerTimeline(timeline: TimelineModel): void {
    let maxIndex: number = -1;
    for (const existingTimeline of this.registeredTimelines) {
      if (timeline.organization === existingTimeline.timeline.organization) {
        // Will be put into that organization's row so should be next color index
        this.registeredTimelines.push({
          timeline,
          colorIndex: existingTimeline.colorIndex + 1,
        });
        return;
      }
      if (timeline.role === existingTimeline.timeline.role) {
        // Matching bar description means they will have the same color
        this.registeredTimelines.push({
          timeline,
          colorIndex: existingTimeline.colorIndex,
        });
        return;
      }
      maxIndex = Math.max(maxIndex, existingTimeline.colorIndex);
    }

    // Does not match an existing section or bar. Just increment from the last index
    this.registeredTimelines.push({ timeline, colorIndex: maxIndex + 1 });
    return;
  }

  get timelineColors(): string[] {
    const colors: string[] = [];
    for (const colorPair of this.colors) {
      colors.push(colorPair.background);
    }
    return colors;
  }

  get timelinesWithColors(): TimelineModel[] {
    const outTimelines: TimelineModel[] = [];
    for (const registeredTimeline of this.registeredTimelines) {
      const { timeline, colorIndex } = registeredTimeline;
      timeline.colorPair = this.colors[colorIndex];
      outTimelines.push(timeline);
    }
    console.table(outTimelines);
    return outTimelines;
  }
}
