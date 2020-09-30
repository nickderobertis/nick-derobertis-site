import { TimelineColorPair, TIMELINE_COLORS } from './timeline-color-pair';
import { TimelineModel } from './timeline-model';

interface TimelineWithColor {
  timeline: TimelineModel;
  colorSortOrder: number;
}

type SectionCounts = { [section: string]: number };

export class TimelineColors {
  colors: TimelineColorPair[] = TIMELINE_COLORS;
  registeredTimelines: TimelineWithColor[] = [];
  registeredSections: string[] = [];
  registeredBarLabels: string[] = [];
  sectionCounts: SectionCounts = {};

  registerTimeline(timeline: TimelineModel): void {
    const colorSortOrder = this.getSortOrder(timeline);
    this.registeredTimelines.push({ timeline, colorSortOrder });

    const { organization, role } = timeline;
    const sectionIdx = this.registeredSections.indexOf(organization);
    const barIdx = this.registeredBarLabels.indexOf(role);
    if (barIdx === -1) {
      this.registeredBarLabels.push(role);
    }
    if (sectionIdx === -1) {
      this.registeredSections.push(organization);
      this.sectionCounts[organization] = 0;
    }

    this.sectionCounts[organization] += 1;
  }

  getSortOrder(timeline: TimelineModel): number {
    const { organization, role } = timeline;
    const sectionIdx = this.registeredSections.indexOf(organization);
    const barIdx = this.registeredBarLabels.indexOf(role);
    if (barIdx !== -1) {
      // For matching bar labels, uses the same color as the previous bar
      for (const existingTimeline of this.registeredTimelines) {
        if (existingTimeline.timeline.role === role) {
          return existingTimeline.colorSortOrder;
        }
      }
      throw new Error('unexpected conditions in TimelineColors.getSortOrder');
    }

    // Sort by section first then by begin date
    let sortOrder: number = 0;
    if (sectionIdx !== -1) {
      // Section/organization already exists, order into that section
      sortOrder += 10000000000000 * sectionIdx;
      // Maintain order within sections by incrementing count each time
      if (this.sectionCounts[organization]) {
        sortOrder += this.sectionCounts[organization];
      }
    } else {
      // New section/organization, will take order of last section
      sortOrder += 10000000000000 * this.registeredSections.length;
    }

    sortOrder += timeline.beginDate.getTime();

    return sortOrder;
  }

  get timelineColors(): string[] {
    const colors: string[] = [];
    for (const colorPair of this.colors) {
      colors.push(colorPair.background);
    }
    return colors;
  }

  get timelinesWithColors(): TimelineModel[] {
    const sortedTimelines = this.registeredTimelines
      .slice(0)
      .sort((a, b) => (a.colorSortOrder > b.colorSortOrder ? 1 : -1));

    // Associate timelines with colors
    const timelinesWithColors: TimelineModel[] = [];
    let colorIndex: number = -1;
    let priorSortOrder: number = -1;
    for (const registeredTimeline of sortedTimelines) {
      const { timeline, colorSortOrder } = registeredTimeline;
      // If sort order is the same, multiple bars need the same color, don't increment color index
      if (colorSortOrder !== priorSortOrder) {
        colorIndex += 1;
      }
      timeline.colorPair = this.colors[colorIndex];
      timelinesWithColors.push(timeline);
      priorSortOrder = colorSortOrder;
    }

    // Re-order timelines with colors back to original order
    const outTimelines: TimelineModel[] = [];
    for (const registeredTimeline of this.registeredTimelines) {
      const { timeline, colorSortOrder } = registeredTimeline;
      const { organization, role } = timeline;
      for (const coloredTimeline of timelinesWithColors) {
        if (
          coloredTimeline.organization === organization &&
          coloredTimeline.role === role
        ) {
          outTimelines.push(coloredTimeline);
        }
      }
    }

    return outTimelines;
  }
}
