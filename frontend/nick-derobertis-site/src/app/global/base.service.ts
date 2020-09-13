import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BaseService {
  apiUrl: string = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get(path: string): Observable<any> {
    const fullPath = this.fullPath(path);
    return this.http.get(fullPath);
  }

  fullPath(path: string): string {
    return `${this.apiUrl}/${path}`;
  }
}
