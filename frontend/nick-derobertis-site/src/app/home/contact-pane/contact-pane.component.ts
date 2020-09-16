import { Component, OnInit } from '@angular/core';
import { EventTypes } from 'src/app/global/classes/event-types';
import {
  personalDetails,
  PersonalDetails,
} from 'src/app/global/classes/personal-details';
import { PageLink } from 'src/app/global/interfaces/page-link';
import { IEvent } from 'src/app/global/services/events/i-event';

@Component({
  selector: 'nds-contact-pane',
  templateUrl: './contact-pane.component.html',
  styleUrls: ['./contact-pane.component.scss'],
})
export class ContactPaneComponent implements OnInit {
  personalDetails: PersonalDetails = personalDetails;
  routerLinks: PageLink[] = [
    {
      link: 'research',
      title: 'View Research',
    },
    {
      link: 'courses',
      title: 'View Courses',
    },
    {
      link: 'software',
      title: 'View Software',
    },
  ];
  // TODO: restructure CV link now that it has a specific event
  normalLinks: PageLink[] = [
    {
      link: 'assets/pdfs/generated/Nick DeRobertis CV.pdf',
      title: 'View CV',
    },
  ];
  viewCVEvent: IEvent = EventTypes.viewCV;

  constructor() {}

  ngOnInit(): void {}
}
