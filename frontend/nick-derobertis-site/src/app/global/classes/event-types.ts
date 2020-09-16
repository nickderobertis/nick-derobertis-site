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

  static viewSyllabus(name: string): IEvent {
    const event: IEvent = {
      action: EventActions.ViewPDF,
      category: EventCategories.Navigation,
    };
    const label = `Syllabus - ${name}`;
    event.label = label;
    return event;
  }

  static viewExternalSite(name: string): IEvent {
    const event: IEvent = {
      action: EventActions.ViewExternalSite,
      category: EventCategories.Navigation,
    };
    event.label = name;
    return event;
  }
}
