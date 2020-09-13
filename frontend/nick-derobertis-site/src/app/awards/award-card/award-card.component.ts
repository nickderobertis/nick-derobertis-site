import { Component, Input, OnInit } from '@angular/core';
import { AwardModel } from './award-model';

@Component({
  selector: 'nds-award-card',
  templateUrl: './award-card.component.html',
  styleUrls: ['./award-card.component.scss'],
})
export class AwardCardComponent implements OnInit {
  @Input() model: AwardModel;

  constructor() {}

  ngOnInit(): void {}
}
