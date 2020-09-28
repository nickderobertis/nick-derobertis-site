import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseService } from 'src/app/global/base.service';
import { APITimelineResponseModel } from 'src/app/global/interfaces/generated/timeline';

@Injectable({
  providedIn: 'root',
})
export class TimelineService extends BaseService {
  constructor(http: HttpClient) {
    super(http);
  }

  getTimelines(): Observable<APITimelineResponseModel> {
    return this.get('timeline/');
  }
}
