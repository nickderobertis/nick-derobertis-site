import { Component, Input, OnInit } from '@angular/core';
import { HomeCarouselItemModel } from './home-carousel-item-model';

@Component({
  selector: 'nds-home-carousel-item',
  templateUrl: './home-carousel-item.component.html',
  styleUrls: ['./home-carousel-item.component.scss'],
})
export class HomeCarouselItemComponent implements OnInit {
  @Input() model: HomeCarouselItemModel;

  constructor() {}

  ngOnInit(): void {}
}
