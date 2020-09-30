import {
  APITimelineModel,
  TimelineTypes,
} from 'src/app/global/interfaces/generated/timeline';
import { TimelineColorPair, TIMELINE_COLORS } from './timeline-color-pair';
import { TimelineColors } from './timeline-colors';
import { TimelineDataRow } from './timeline-data-row';

export class TimelineModel {
  organization: string;
  role: string;
  shortOrganization: string;
  shortRole: string;
  location: string;
  timelineId: number;
  itemType: TimelineTypes;
  beginDate: Date;
  endDate?: Date;
  timelineEndDate: Date;
  description?: string[];
  colorPair: TimelineColorPair;

  constructor(args: APITimelineModel, colorPair?: TimelineColorPair) {
    this.organization = args.organization;
    this.role = args.role;
    this.location = args.location;
    this.timelineId = args.timeline_id;
    this.itemType = args.item_type;
    this.shortOrganization = args.short_organization;
    this.shortRole = args.short_role;

    this.beginDate = new Date(args.begin_date);
    if (args.end_date) {
      this.endDate = new Date(args.end_date);
      this.timelineEndDate = this.endDate;
    } else {
      this.timelineEndDate = new Date();
    }
    // Trim future end dates to today
    if (this.timelineEndDate > new Date()) {
      this.timelineEndDate = new Date();
    }
    if (args.description) {
      this.description = args.description;
    }
    if (colorPair) {
      this.colorPair = colorPair;
    }
  }

  static arrayFromAPIArray(timelines: APITimelineModel[]): TimelineModel[] {
    const colors: TimelineColors = new TimelineColors();
    for (const timeline of timelines) {
      const mod = new TimelineModel(timeline);
      colors.registerTimeline(mod);
    }
    return colors.timelinesWithColors;
  }

  toChartData(): TimelineDataRow {
    return [this.organization, this.role, this.beginDate, this.timelineEndDate];
  }

  toShortChartData(): TimelineDataRow {
    return [
      this.shortOrganization,
      this.shortRole,
      this.beginDate,
      this.timelineEndDate,
    ];
  }

  get endDateStr(): string {
    if (!this.endDate) {
      return 'Present';
    }

    return dateAsYearMonth(this.endDate);
  }

  get beginDateStr(): string {
    return dateAsYearMonth(this.beginDate);
  }
}

function dateAsYearMonth(d: Date): string {
  const year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d);
  const month = new Intl.DateTimeFormat('en', { month: 'short' }).format(d);
  return `${month} ${year}`;
}
