import { EventActions } from '../enums/event-actions.enum';
import { EventCategories } from '../enums/event-categories.enum';
import { EventLabels } from '../enums/event-labels.enum';
import { IEvent } from '../services/events/i-event';

export class EventTypes {
  static viewCV: IEvent = {
    action: EventActions.ViewPDF,
    category: EventCategories.Navigation,
    label: EventLabels.CV,
  };
}
