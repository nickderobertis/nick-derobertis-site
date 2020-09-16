import { EventAppContext } from './event-app-context';
import { EventModel } from './event-model';

export interface IEventHandler {
  isEnabled: (appContext: EventAppContext) => boolean;
  pageView: (pagePath: string) => void;
  event: (event: EventModel) => void;
}
