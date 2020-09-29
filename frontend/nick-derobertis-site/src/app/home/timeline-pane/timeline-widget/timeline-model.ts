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
    } else {
      this.endDate = new Date();
    }
    // Trim future end dates to today
    if (this.endDate > new Date()) {
      this.endDate = new Date();
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
    return [this.organization, this.role, this.beginDate, this.endDate];
  }
}
