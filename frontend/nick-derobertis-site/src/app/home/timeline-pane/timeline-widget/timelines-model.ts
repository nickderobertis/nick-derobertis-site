import {
  APITimelineResponseModel,
  TimelineTypes,
} from 'src/app/global/interfaces/generated/timeline';
import { TimelineColorPair, TIMELINE_COLORS } from './timeline-color-pair';
import { TimelineColors } from './timeline-colors';
import { TimelineDataRow } from './timeline-data-row';
import { TimelineModel } from './timeline-model';

const HEIGHT_PER_SINGLE_ROW: number = 40.99;
const HEIGHT_PER_DOUBLE_ROW: number = 70.98;
const HEIGHT_PADDING: number = 60;

export class TimelinesModel {
  timelines: TimelineModel[];
  chartColumns: {
    type: string;
    id?: string;
    role?: string;
    p?: { html: boolean };
  }[] = [
    { type: 'string', id: 'Organization' },
    { type: 'string', id: 'Position' },
    { type: 'date', id: 'Start' },
    { type: 'date', id: 'End' },
  ];
  chartHeight: number;
  colors: TimelineColors = new TimelineColors();
  timelineColors: string[];

  constructor(args?: APITimelineResponseModel) {
    if (!args) {
      return;
    }
    this.timelines = TimelineModel.arrayFromAPIArray(args.items);
    this.chartHeight = chartHeightFromTimelines(this.timelines);
    this.timelineColors = this.colors.timelineColors;
  }

  toChartData(): TimelineDataRow[] {
    const data: TimelineDataRow[] = [];
    for (const timeline of this.timelines) {
      const timelineData: TimelineDataRow = timeline.toChartData();
      data.push(timelineData);
    }
    return data;
  }

  filter(allowedTypes: TimelineTypes[]): TimelinesModel {
    const colors: TimelineColors = new TimelineColors();
    for (const timeline of this.timelines) {
      if (allowedTypes.indexOf(timeline.itemType) !== -1) {
        colors.registerTimeline(timeline);
      }
    }
    const acceptedTimelines: TimelineModel[] = colors.timelinesWithColors;
    const mod: TimelinesModel = new TimelinesModel();
    mod.timelines = acceptedTimelines;
    mod.chartHeight = chartHeightFromTimelines(acceptedTimelines);
    mod.timelineColors = mod.colors.timelineColors;
    return mod;
  }
}

interface TimeRangeCount {
  begin: Date;
  end: Date;
  count: number;
}

interface TimeRangesCounts {
  [organization: string]: TimeRangeCount[];
}

function chartHeightFromTimelines(timelines: TimelineModel[]): number {
  const organizationRanges: TimeRangesCounts = chartRangesFromTimelines(
    timelines
  );
  let height: number = HEIGHT_PADDING;
  for (const organization of Object.keys(organizationRanges)) {
    const ranges = organizationRanges[organization];
    for (const range of ranges) {
      if (range.count === 1) {
        height += HEIGHT_PER_SINGLE_ROW;
      } else if (range.count === 2) {
        height += HEIGHT_PER_DOUBLE_ROW;
      } else {
        console.warn(
          `no handling for ${range.count} number per row in timeline chart`
        );
        height += HEIGHT_PER_DOUBLE_ROW;
      }
    }
  }
  return height;
}

function chartRangesFromTimelines(
  timelines: TimelineModel[]
): TimeRangesCounts {
  const ranges: TimeRangesCounts = {};
  for (const timeline of timelines) {
    const existingRanges = ranges[timeline.organization] || [];
    let rangeMatched: boolean = false;
    for (const existingRange of existingRanges) {
      if (
        existingRange.begin &&
        dateRangeOverlaps(
          existingRange.begin,
          existingRange.end,
          timeline.beginDate,
          timeline.timelineEndDate
        )
      ) {
        existingRange.count += 1;
        existingRange.begin = new Date(
          Math.min.apply(null, [existingRange.begin, timeline.beginDate])
        );
        existingRange.end = new Date(
          Math.max.apply(null, [existingRange.end, timeline.timelineEndDate])
        );
        rangeMatched = true;
      }
    }
    if (!rangeMatched) {
      const newRange = {
        begin: timeline.beginDate,
        end: timeline.timelineEndDate,
        count: 1,
      };
      existingRanges.push(newRange);
    }
    ranges[timeline.organization] = existingRanges;
  }
  return ranges;
}

function dateRangeOverlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  if (aStart <= bStart && bStart <= aEnd) {
    return true;
  } // b starts in a
  if (aStart <= bEnd && bEnd <= aEnd) {
    return true;
  } // b ends in a
  if (bStart < aStart && aEnd < bEnd) {
    return true;
  } // a in b
  return false;
}
