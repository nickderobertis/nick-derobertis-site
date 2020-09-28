import { APITimelineResponseModel } from 'src/app/global/interfaces/generated/timeline';
import { TimelineModel } from './timeline-model';

export class TimelinesModel {
  timelines: TimelineModel[];

  constructor(args: APITimelineResponseModel) {
    this.timelines = TimelineModel.arrayFromAPIArray(args.items);
  }
}
