import { Component, OnInit } from '@angular/core';
import { PageLink } from 'src/app/global/interfaces/page-link';

@Component({
  selector: 'nds-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  routerLinks: PageLink[] = [
    {
      link: 'home',
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
  normalLinks: PageLink[] = [
    {
      link: 'pdfs/generated/Nick DeRobertis CV.pdf',
      title: 'CV',
    },
  ];

  constructor() {}

  ngOnInit(): void {}
}
