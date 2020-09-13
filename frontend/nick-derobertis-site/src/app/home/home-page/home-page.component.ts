import { Component, OnInit } from '@angular/core';
import { HomeCardModel } from '../home-card/home-card-model';

@Component({
  selector: 'nds-home-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
})
export class HomePageComponent implements OnInit {
  cardModels: HomeCardModel[] = [
    new HomeCardModel({
      heading: 'Research',
      bodyText: `
      I am a skilled empirical researcher working in the finance field.
      My latest work focuses on central bank intervention in markets
      and cryptocurrency valuation.
      `,
      link: { link: 'research', title: 'View Research' },
      iconClasses: ['fas', 'fa-chart-bar', 'fa-5x'],
    }),
    new HomeCardModel({
      heading: 'Teaching',
      bodyText: `
      I've taught multiple courses at multiple universities.
      Currently I am teaching Financial Modeling using
      Python and Excel at the University of Florida.
      `,
      link: { link: 'courses', title: 'View Courses' },
      iconClasses: ['fas', 'fa-graduation-cap', 'fa-5x'],
    }),
    new HomeCardModel({
      heading: 'Engineering',
      bodyText: `
      Whether it is a data science problem,
      finding the best way to teach a topic, or
      building a web app, I optimize my approach
      and usually build open-source tools along the way.
      `,
      link: { link: 'software', title: 'View Software' },
      iconClasses: ['fas', 'fa-cogs', 'fa-5x'],
    }),
  ];

  constructor() {}

  ngOnInit(): void {}
}
