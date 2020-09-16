import { IGTagEvent } from './gtag/i-gtag-event';
import { IEvent } from './i-event';

export class EventModel implements IEvent {
  action: string;
  category?: string;
  label?: string;
  value?: number;
  interaction?: boolean;

  constructor(args: IEvent) {
    this.action = args.action;

    if (args.category) {
      this.category = args.category;
    }
    if (args.label) {
      this.label = args.label;
    }
    if (args.value) {
      this.value = args.value;
    }
    if (args.interaction) {
      this.interaction = args.interaction;
    }
  }

  toGTagEvent(): IGTagEvent {
    const gtagEvent: IGTagEvent = {};
    if (this.category) {
      gtagEvent.event_category = this.category;
    }
    if (this.label) {
      gtagEvent.event_label = this.label;
    }
    if (this.value) {
      gtagEvent.value = this.value;
    }
    if (this.interaction) {
      gtagEvent.non_interaction = !this.interaction;
    }
    return gtagEvent;
  }
}
