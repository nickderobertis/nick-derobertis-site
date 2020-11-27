import { Component, OnInit } from '@angular/core';
import { title } from 'process';
import { HomeCarouselItemModel } from './home-carousel-item/home-carousel-item-model';

@Component({
  selector: 'nds-home-carousel',
  templateUrl: './home-carousel.component.html',
  styleUrls: ['./home-carousel.component.scss'],
})
export class HomeCarouselComponent implements OnInit {
  itemModels: HomeCarouselItemModel[] = [
    new HomeCarouselItemModel({
      headerText: 'Finance Ph.D. Candidate',
      bodyText:
        'Research focuses on market intervention, alternative assets, and behavioral finance',
      links: [{ link: 'research', title: 'Research' }],
      captionClasses: ['carousel-caption', 'text-left'],
      imageHref: 'assets/images/finance-research-banner.jpg',
    }),
    new HomeCarouselItemModel({
      headerText: 'Effective Teacher and Communicator',
      bodyText:
        'Experienced in teaching hundreds of students across multiple courses both in-person and online',
      imageHref: 'assets/images/teaching-banner.jpg',
      links: [{ link: 'courses', title: 'Courses' }],
    }),
    new HomeCarouselItemModel({
      headerText: 'Data Scientist',
      bodyText:
        'Highly proficient at extracting insights from data, effective at summarizing and visualizing insights',
      captionClasses: ['carousel-caption', 'text-right'],
      imageHref: 'assets/images/data-science-banner.jpg',
      fragmentLinks: [{ link: 'skills', title: 'Skills' }],
    }),
    new HomeCarouselItemModel({
      headerText: 'Full-Stack Software Engineer',
      bodyText:
        'Maintainer of dozens of open-source packages, experienced in creating full web applications',
      imageHref: 'assets/images/software-engineering-banner.jpg',
      links: [{ link: 'software', title: 'Software Projects' }],
    }),
  ];

  constructor() {}

  ngOnInit(): void {}
}
