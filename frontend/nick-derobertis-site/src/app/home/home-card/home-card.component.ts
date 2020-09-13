import { Component, Input, OnInit } from '@angular/core';
import { HomeCardModel } from './home-card-model';

@Component({
  selector: 'nds-home-card',
  templateUrl: './home-card.component.html',
  styleUrls: ['./home-card.component.scss'],
})
export class HomeCardComponent implements OnInit {
  @Input() model: HomeCardModel;

  constructor() {}

  ngOnInit(): void {}
}
