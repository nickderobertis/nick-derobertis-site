import { TimelineFilterTypes } from 'src/app/home/timeline-pane/timeline-widget/timeline-filter-types.enum';
import { EventActions } from '../enums/event-actions.enum';
import { EventCategories } from '../enums/event-categories.enum';
import { EventLabels } from '../enums/event-labels.enum';
import { IEvent } from '../services/events/i-event';
import { IItem } from '../services/events/i-item';

export class EventTypes {
  static viewGithub: IEvent = EventTypes.viewExternalSite('Github');
  static viewAPI: IEvent = EventTypes.viewExternalSite('API');
  static viewLinkedIn: IEvent = EventTypes.viewExternalSite('LinkedIn');
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
  static viewPhone: IEvent = {
    action: EventActions.ViewPhone,
    category: EventCategories.Navigation,
    label: EventLabels.HomePageButton,
  };
  static callPhone: IEvent = {
    action: EventActions.CallPhone,
    category: EventCategories.Navigation,
    label: EventLabels.HomePageButton,
  };
  static viewSkillsChart: IEvent = {
    action: EventActions.ViewSkillChart,
    category: EventCategories.Navigation,
    label: EventLabels.HomePageButton,
  };
  static viewSkillsDropdowns: IEvent = {
    action: EventActions.ViewSkillDropdowns,
    category: EventCategories.Navigation,
    label: EventLabels.HomePageButton,
  };
  static filterTimelineEmployment: IEvent = EventTypes.filterTimeline(
    TimelineFilterTypes.EMPLOYMENT
  );
  static filterTimelineEducation: IEvent = EventTypes.filterTimeline(
    TimelineFilterTypes.EDUCATION
  );

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

  static viewTimelineDetail(organization: string, role: string): IEvent {
    const event: IEvent = {
      action: EventActions.ViewTimeline,
      category: EventCategories.Navigation,
    };
    const label = `${organization} - ${role}`;
    event.label = label;
    return event;
  }

  static filterTimeline(filterType: TimelineFilterTypes): IEvent {
    const event: IEvent = {
      action: EventActions.FilterTimeline,
      category: EventCategories.Interaction,
      label: filterType,
    };

    return event;
  }

  static hoverChartSkill(title: string): IEvent {
    const event: IEvent = {
      action: EventActions.HoverSkillChart,
      category: EventCategories.Interaction,
      label: title,
    };

    return event;
  }
}
