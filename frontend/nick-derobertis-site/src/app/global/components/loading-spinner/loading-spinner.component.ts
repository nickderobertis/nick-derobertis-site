import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'nds-loading-spinner',
  templateUrl: './loading-spinner.component.html',
  styleUrls: ['./loading-spinner.component.scss'],
})
export class LoadingSpinnerComponent implements OnInit {
  @Input() size: number = 40;

  constructor() {}

  ngOnInit(): void {}

  get fontSize(): string {
    return `${this.size}px`;
  }
}
