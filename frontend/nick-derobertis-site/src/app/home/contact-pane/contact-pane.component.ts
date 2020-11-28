import { Component, OnInit } from '@angular/core';
import { EventTypes } from 'src/app/global/classes/event-types';
import {
  personalDetails,
  PersonalDetails,
} from 'src/app/global/classes/personal-details';
import { FilePaths } from 'src/app/global/enums/file-paths.enum';
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
      link: FilePaths.CV,
      title: 'View CV',
    },
  ];
  viewCVEvent: IEvent = EventTypes.viewCV;
  sendMeEmailEvent: IEvent = EventTypes.sendMeEmail;
  callPhoneEvent: IEvent = EventTypes.callPhone;
  viewLinkedInEvent: IEvent = EventTypes.viewLinkedIn;
  viewGithubEvent: IEvent = EventTypes.viewGithub;

  constructor() {}

  ngOnInit(): void {}
}
