import { Component, OnInit } from '@angular/core';
import {
  personalDetails,
  PersonalDetails,
} from 'src/app/global/classes/personal-details';
import { PageLink } from 'src/app/global/interfaces/page-link';

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
  normalLinks: PageLink[] = [
    {
      link: 'assets/pdfs/generated/Nick DeRobertis CV.pdf',
      title: 'View CV',
    },
  ];

  constructor() {}

  ngOnInit(): void {}
}
