import { Component, OnInit } from '@angular/core';
import { ChartMouseOverEvent, ChartType } from 'angular-google-charts';
import { Observable } from 'rxjs';
import {
  APITimelineResponseModel,
  TimelineTypes,
} from 'src/app/global/interfaces/generated/timeline';
import { TimelineService } from '../timeline.service';
import { TimelineDataRow } from './timeline-data-row';
import { TimelineModel } from './timeline-model';
import { TimelinesModel } from './timelines-model';

@Component({
  selector: 'nds-timeline-widget',
  templateUrl: './timeline-widget.component.html',
  styleUrls: ['./timeline-widget.component.scss'],
})
export class TimelineWidgetComponent implements OnInit {
  model: TimelinesModel;
  fullModel: TimelinesModel;
  loading: boolean = true;
  chartType: ChartType = ChartType.Timeline;
  chartData: TimelineDataRow[];
  selectedModel: TimelineModel;
  showEmployment: boolean = true;
  showEducation: boolean = true;

  constructor(private timelineService: TimelineService) {}

  ngOnInit(): void {
    this.getTimelines();
  }

  getTimelines(): void {
    this.timelineService
      .getTimelines()
      .subscribe((timelines: APITimelineResponseModel) => {
        this.model = new TimelinesModel(timelines);
        this.fullModel = new TimelinesModel(timelines);
        this.chartData = this.model.toChartData();
        this.loading = false;
      });
  }

  onMouseOver($event: ChartMouseOverEvent): void {
    if ($event.row === undefined) {
      return;
    }
    this.selectedModel = this.model.timelines[$event.row];

    this.timelineService.pushSelectRowEvent(this.selectedModel);
  }

  checkboxChanged(): void {
    this.loading = true;
    if (!this.showEducation && !this.showEmployment) {
      this.model = undefined;
      this.loading = false;
      return;
    }
    const allowedTypes: TimelineTypes[] = [];
    if (this.showEducation) {
      allowedTypes.push('education');
    }
    if (this.showEmployment) {
      allowedTypes.push('academic employment');
      allowedTypes.push('professional employment');
    }
    this.model = this.fullModel.filter(allowedTypes);
    this.chartData = this.model.toChartData();
    this.loading = false;
  }
}
