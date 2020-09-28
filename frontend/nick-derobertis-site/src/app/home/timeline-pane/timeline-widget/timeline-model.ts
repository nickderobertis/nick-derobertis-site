import {
  APITimelineModel,
  TimelineTypes,
} from 'src/app/global/interfaces/generated/timeline';

export class TimelineModel {
  organization: string;
  role: string;
  location: string;
  itemType: TimelineTypes;
  beginDate: string;
  endDate?: string;
  description?: string[];

  constructor(args: APITimelineModel) {
    this.organization = args.organization;
    this.role = args.role;
    this.location = args.location;
    this.itemType = args.item_type;
    this.beginDate = args.begin_date;
    if (args.end_date) {
      this.endDate = args.end_date;
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
}
