import { isPlatformServer } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { CSSVariables } from '../classes/css-variables';

@Injectable({
  providedIn: 'root',
})
export class CSSVariablesService {
  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  get(name: string): string {
    if (isPlatformServer(this.platformId)) {
      return '';
    }

    return CSSVariables.get(name);
  }

  set(name: string, value: string): void {
    if (isPlatformServer(this.platformId)) {
      throw new Error('cannot set CSS variables while platform is server');
    }

    return CSSVariables.set(name, value);
  }
}
