import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { EventAppContext } from './event-app-context';
import { GTagEventHandler } from './gtag-event-handler';
import { IEventHandler } from './i-event-handler';

@Injectable({
  providedIn: 'root',
})
export class EventService {
  handlers: IEventHandler[] = [new GTagEventHandler()];

  constructor(@Inject(PLATFORM_ID) private readonly platformId: Object) {}

  get appContext(): EventAppContext {
    return { isBrowser: isPlatformBrowser(this.platformId) };
  }

  pageView(pagePath: string): void {
    this._reportToAnalytics('pageView', [pagePath]);
  }

  private _reportToAnalytics(methodName: string, args: any[]): void {
    const context = this.appContext;
    for (const handler of this.handlers) {
      if (handler.isEnabled(context)) {
        handler[methodName](...args);
      }
    }
  }
}
