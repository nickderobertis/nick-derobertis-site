import { isPlatformServer } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { ChartMouseOverEvent, ChartType } from 'angular-google-charts';
import { Observable } from 'rxjs';
import { CSSVariables } from 'src/app/global/classes/css-variables';
import { EventTypes } from 'src/app/global/classes/event-types';
import {
  APITimelineResponseModel,
  TimelineTypes,
} from 'src/app/global/interfaces/generated/timeline';
import { CSSVariablesService } from 'src/app/global/services/css-variables.service';
import { EventService } from 'src/app/global/services/events/event.service';
import { LoggerService } from 'src/app/global/services/logger.service';
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
  drawnWidth: number;
  filterEmploymentEvent = EventTypes.filterTimelineEmployment;
  filterEducationEvent = EventTypes.filterTimelineEducation;

  constructor(
    private timelineService: TimelineService,
    private cssVariablesService: CSSVariablesService,
    private eventService: EventService,
    @Inject(PLATFORM_ID) private platformId,
    private log: LoggerService
  ) {}

  ngOnInit(): void {
    this.getTimelines();
  }

  getTimelines(): void {
    this.timelineService.getTimelines().subscribe(
      (timelines: APITimelineResponseModel) => {
        this.model = new TimelinesModel(timelines);
        this.fullModel = new TimelinesModel(timelines);
        this.chartData = this.sizedChartData;
        this.drawnWidth = this.screenWidth;
        this.loading = false;
      },
      (error: Error) => {
        this.log.exception(error, 'Error getting timeline information');
      }
    );
  }

  onMouseOver($event: ChartMouseOverEvent): void {
    if ($event.row === undefined) {
      return;
    }
    this.selectedModel = this.model.timelines[$event.row];

    this.eventService.event(
      EventTypes.viewTimelineDetail(
        this.selectedModel.organization,
        this.selectedModel.role
      )
    );
    this.timelineService.pushSelectRowEvent(this.selectedModel);
  }

  onChartReady(): void {
    if (this.drawnWidth !== this.screenWidth) {
      // Screen must have been resized
      this.chartData = this.sizedChartData;
      this.drawnWidth = this.screenWidth;
    }
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

  get screenWidth(): number {
    if (isPlatformServer(this.platformId)) {
      return 600;
    }
    return window.innerWidth;
  }

  get shortCutoff(): number {
    const lgBreakpointPx = this.cssVariablesService.get('breakpoint-lg');
    if (lgBreakpointPx) {
      // On browser, got actual breakpoint
      return CSSVariables.numbersFromString(lgBreakpointPx);
    }
    // On server, need placeholder cutoff
    return 1000;
  }

  get sizedChartData(): TimelineDataRow[] {
    const width: number = this.screenWidth;
    if (width > this.shortCutoff) {
      return this.model.toChartData();
    } else {
      return this.model.toShortChartData();
    }
  }
}
