import { Component, OnInit } from '@angular/core';
import { EventTypes } from 'src/app/global/classes/event-types';
import { PageLink } from 'src/app/global/interfaces/page-link';
import { IEvent } from 'src/app/global/services/events/i-event';

@Component({
  selector: 'nds-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  routerLinks: PageLink[] = [
    {
      link: '',
      title: 'Home',
    },
    {
      link: 'story',
      title: 'Story',
    },
    {
      link: 'research',
      title: 'Research',
    },
    {
      link: 'software',
      title: 'Software',
    },
    {
      link: 'courses',
      title: 'Courses',
    },
  ];
  // TODO: better structure for header links now that CV has specific event
  normalLinks: PageLink[] = [
    {
      link: 'assets/pdfs/generated/Nick DeRobertis CV.pdf',
      title: 'CV',
    },
  ];
  viewCVEvent: IEvent = EventTypes.viewCV;

  constructor() {}

  ngOnInit(): void {}
}
