import { Component, Input, OnInit } from '@angular/core';
import { SoftwareProjectModel } from './software-project-model';

@Component({
  selector: 'nds-software-card',
  templateUrl: './software-card.component.html',
  styleUrls: ['./software-card.component.scss'],
})
export class SoftwareCardComponent implements OnInit {
  @Input() model: SoftwareProjectModel;

  constructor() {}

  ngOnInit(): void {}
}
