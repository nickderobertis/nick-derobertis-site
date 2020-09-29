import { APITimelineResponseModel } from 'src/app/global/interfaces/generated/timeline';
import { TimelineDataRow } from './timeline-data-row';
import { TimelineModel } from './timeline-model';

export class TimelinesModel {
  timelines: TimelineModel[];
  chartColumns: { type: string; id?: string; role?: string }[] = [
    { type: 'string', id: 'Organization' },
    { type: 'string', id: 'Position' },
    { type: 'string', role: 'tooltip' },
    { type: 'date', id: 'Start' },
    { type: 'date', id: 'End' },
  ];

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
