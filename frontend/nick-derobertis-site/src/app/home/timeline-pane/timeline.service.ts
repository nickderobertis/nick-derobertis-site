import { HttpClient } from '@angular/common/http';
import { EventEmitter, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseService } from 'src/app/global/base.service';
import { APITimelineResponseModel } from 'src/app/global/interfaces/generated/timeline';
import { TimelineModel } from './timeline-widget/timeline-model';

@Injectable({
  providedIn: 'root',
})
export class TimelineService extends BaseService {
  selectedRowEvent$: EventEmitter<TimelineModel> = new EventEmitter();

  constructor(http: HttpClient) {
    super(http);
  }

  getTimelines(): Observable<APITimelineResponseModel> {
    return this.get('timeline/');
  }

  pushSelectRowEvent(model: TimelineModel): void {
    this.selectedRowEvent$.emit(model);
  }
}
