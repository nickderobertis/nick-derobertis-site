import { EventActions } from '../enums/event-actions.enum';
import { EventCategories } from '../enums/event-categories.enum';
import { EventLabels } from '../enums/event-labels.enum';
import { IEvent } from '../services/events/i-event';

export class EventTypes {
  static viewGithub: IEvent = EventTypes.viewExternalSite('Github');
  static viewAPI: IEvent = EventTypes.viewExternalSite('API');
  static viewCV: IEvent = {
    action: EventActions.ViewPDF,
    category: EventCategories.Navigation,
    label: EventLabels.CV,
  };
  static sendMeEmail: IEvent = {
    action: EventActions.SendEmail,
    category: EventCategories.Navigation,
    label: EventLabels.HomePageButton,
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
