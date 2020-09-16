import { EventAppContext } from '../event-app-context';
import { EventModel } from '../event-model';
import { IEventHandler } from '../i-event-handler';

declare let gtag: Function;

export class GTagEventHandler implements IEventHandler {
  isEnabled(context: EventAppContext): boolean {
    return context.isBrowser;
  }

  pageView(pagePath: string): void {
    gtag('event', 'page_view', {
      page_path: pagePath,
    });
  }

  event(event: EventModel): void {
    gtag('event', event.action, event.toGTagEvent());
  }
}
