import { Directive, HostListener, Input } from '@angular/core';
import { EventService } from '../services/events/event.service';
import { IEvent } from '../services/events/i-event';

@Directive({
  selector: '[ndsHoverEvent]',
})
export class HoverEventDirective {
  @Input() event: IEvent;
  @HostListener('mouseenter', ['$event']) onClick($event: MouseEvent): void {
    this.trackEvent();
  }

  constructor(private eventService: EventService) {}

  trackEvent(): void {
    this.eventService.event(this.event);
  }
}
