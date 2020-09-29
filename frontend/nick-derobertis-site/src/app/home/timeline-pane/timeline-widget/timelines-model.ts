import { APITimelineResponseModel } from 'src/app/global/interfaces/generated/timeline';
import { TimelineDataRow } from './timeline-data-row';
import { TimelineModel } from './timeline-model';

export class TimelinesModel {
  timelines: TimelineModel[];
  chartColumns: string[] = ['Organization', 'Start', 'End'];

  constructor(args: APITimelineResponseModel) {
    this.timelines = TimelineModel.arrayFromAPIArray(args.items);
  }

  toChartData(): TimelineDataRow[] {
    const data: TimelineDataRow[] = [];
    for (const timeline of this.timelines) {
      const timelineData: TimelineDataRow = timeline.toChartData();
      data.push(timelineData);
    }
    return data;
  }
}
