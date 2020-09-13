import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseService } from '../global/base.service';
import { APIResearchResponseModel } from '../global/interfaces/generated/research';

@Injectable({
  providedIn: 'root',
})
export class ResearchService extends BaseService {
  constructor(http: HttpClient) {
    super(http);
  }

  getResearch(): Observable<APIResearchResponseModel> {
    return this.get('research');
  }
}
