import { EventAppContext } from './event-app-context';
import { EventModel } from './event-model';
import { IItem } from './i-item';

export interface IEventHandler {
  isEnabled: (appContext: EventAppContext) => boolean;
  pageView: (pagePath: string) => void;
  event: (event: EventModel) => void;
  viewItem: (items: IItem[]) => void;
}
