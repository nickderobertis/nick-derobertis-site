import { APITimelineResponseModel } from 'src/app/global/interfaces/generated/timeline';
import { TimelineModel } from './timeline-model';

export class TimelinesModel {
  timelines: TimelineModel[];
  chartColumns: string[] = ['Organization', 'Start', 'End'];

  constructor(args: APITimelineResponseModel) {
    this.timelines = TimelineModel.arrayFromAPIArray(args.items);
  }

  toChartData(): [string, Date, Date][] {
    const data: [string, Date, Date][] = [];
    for (const timeline of this.timelines) {
      const timelineData: [string, Date, Date] = timeline.toChartData();
      data.push(timelineData);
    }
    return data;
  }
}
