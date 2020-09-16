import { EventAppContext } from './event-app-context';

export interface IEventHandler {
  isEnabled: (appContext: EventAppContext) => boolean;
  pageView: (pagePath: string) => void;
}
