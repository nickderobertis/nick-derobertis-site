import { Component, Input, OnInit } from '@angular/core';
import { CoursePaneModel } from './course-pane-model';

@Component({
  selector: 'nds-course-pane',
  templateUrl: './course-pane.component.html',
  styleUrls: ['./course-pane.component.scss'],
})
export class CoursePaneComponent implements OnInit {
  @Input() model: CoursePaneModel;
  @Input() isReversed: boolean = false;

  constructor() {}

  ngOnInit(): void {}

  get containerClassStr(): string {
    let classStr: string = 'row course-pane';
    if (this.isReversed) {
      classStr += ' flex-row-reverse';
    }
    return classStr;
  }
}
