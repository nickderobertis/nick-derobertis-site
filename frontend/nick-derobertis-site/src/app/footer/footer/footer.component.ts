import { Component, OnInit } from '@angular/core';
import { copyright } from 'src/app/global/classes/copyright';
import { EventTypes } from 'src/app/global/classes/event-types';
import { IEvent } from 'src/app/global/services/events/i-event';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'nds-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent implements OnInit {
  copyright: string = copyright.str;
  apiDocsUrl: string = `${environment.apiUrl}/docs`;
  viewAPIEvent: IEvent = EventTypes.viewAPI;

  constructor() {}

  ngOnInit(): void {}

  scrollToTop(event: MouseEvent): void {
    window.scrollTo(0, 0);
  }
}
