import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseService } from '../global/base.service';
import {
  APISkillModel,
  APISkillStatisticsModel,
} from '../global/interfaces/generated/skills';

@Injectable({
  providedIn: 'root',
})
export class SkillsService extends BaseService {
  constructor(http: HttpClient) {
    super(http);
  }

  getParentSkills(): Observable<APISkillModel[]> {
    return this.get('skills');
  }

  getStatistics(): Observable<APISkillStatisticsModel> {
    return this.get('skills/stats');
  }

  getChildSkills(skillTitle: string): Observable<APISkillModel[]> {
    return this.get('skills/children', { title: skillTitle });
  }
}
