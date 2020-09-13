import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseService } from '../global/base.service';
import { APIAwardModel } from '../global/interfaces/generated/awards';

@Injectable({
  providedIn: 'root',
})
export class AwardService extends BaseService {
  constructor(http: HttpClient) {
    super(http);
  }

  getAwards(): Observable<APIAwardModel[]> {
    return this.get('awards/selected');
  }
}
