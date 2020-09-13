import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseService } from '../global/base.service';
import { APICourseModel } from '../global/interfaces/generated/courses';

@Injectable({
  providedIn: 'root',
})
export class CourseService extends BaseService {
  constructor(http: HttpClient) {
    super(http);
  }

  getCourses(): Observable<APICourseModel[]> {
    return this.get('courses/');
  }
}
