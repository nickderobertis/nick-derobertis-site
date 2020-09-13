import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseService } from '../global/base.service';
import { APISoftwareModel } from '../global/interfaces/generated/software';

@Injectable({
  providedIn: 'root',
})
export class SoftwareService extends BaseService {
  constructor(http: HttpClient) {
    super(http);
  }

  getSoftware(): Observable<APISoftwareModel[]> {
    return this.get('software/');
  }
}
