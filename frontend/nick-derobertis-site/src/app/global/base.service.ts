import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BaseService {
  apiUrl: string = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get(path: string, params?: { [key: string]: string }): Observable<any> {
    const fullPath = this.fullPath(path);
    const httpParams = new HttpParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        httpParams.set(key, value);
      }
    }
    return this.http.get(fullPath, { params });
  }

  fullPath(path: string): string {
    return `${this.apiUrl}/${path}`;
  }
}
