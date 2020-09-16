import { EventActions } from '../enums/event-actions.enum';
import { EventCategories } from '../enums/event-categories.enum';
import { IEvent } from '../services/events/i-event';

export class EventTypes {
  static viewCV: IEvent = {
    action: EventActions.ViewCV,
    category: EventCategories.Navigation,
    label: EventActions.ViewCV,
  };
}
