import { Directive, HostListener, Input } from '@angular/core';
import { EventService } from '../services/events/event.service';
import { IEvent } from '../services/events/i-event';

@Directive({
  selector: '[ndsClickEvent]',
})
export class ClickEventDirective {
  @Input() event: IEvent;
  @HostListener('click', ['$event']) onClick($event: MouseEvent): void {
    this.trackEvent();
  }

  constructor(private eventService: EventService) {}

  trackEvent(): void {
    this.eventService.event(this.event);
  }
}
