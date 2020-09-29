import {
  APITimelineModel,
  TimelineTypes,
} from 'src/app/global/interfaces/generated/timeline';
import { TimelineDataRow } from './timeline-data-row';

export class TimelineModel {
  organization: string;
  role: string;
  location: string;
  timelineId: number;
  itemType: TimelineTypes;
  beginDate: Date;
  endDate?: Date;
  timelineEndDate: Date;
  description?: string[];

  constructor(args: APITimelineModel) {
    this.organization = args.organization;
    this.role = args.role;
    this.location = args.location;
    this.timelineId = args.timeline_id;
    this.itemType = args.item_type;
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
  }

  static arrayFromAPIArray(timelines: APITimelineModel[]): TimelineModel[] {
    const modelArr: TimelineModel[] = [];
    for (const timeline of timelines) {
      const mod = new TimelineModel(timeline);
      modelArr.push(mod);
    }
    return modelArr;
  }

  toChartData(): TimelineDataRow {
    return [this.organization, this.role, this.beginDate, this.timelineEndDate];
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
