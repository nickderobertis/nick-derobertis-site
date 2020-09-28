import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { APITimelineResponseModel } from 'src/app/global/interfaces/generated/timeline';
import { TimelineService } from '../timeline.service';
import { TimelineModel } from './timeline-model';
import { TimelinesModel } from './timelines-model';

@Component({
  selector: 'nds-timeline-widget',
  templateUrl: './timeline-widget.component.html',
  styleUrls: ['./timeline-widget.component.scss'],
})
export class TimelineWidgetComponent implements OnInit {
  model: TimelinesModel;
  loading: boolean = true;

  constructor(private timelineService: TimelineService) {}

  ngOnInit(): void {
    this.getTimelines();
  }

  getTimelines(): void {
    this.timelineService
      .getTimelines()
      .subscribe((timelines: APITimelineResponseModel) => {
        this.model = new TimelinesModel(timelines);
        this.loading = false;
      });
  }
}
