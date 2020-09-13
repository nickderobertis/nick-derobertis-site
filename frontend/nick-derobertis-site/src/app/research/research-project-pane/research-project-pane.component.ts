import { Component, Input, OnInit } from '@angular/core';
import { ResearchModel } from './research-model';

@Component({
  selector: 'nds-research-project-pane',
  templateUrl: './research-project-pane.component.html',
  styleUrls: ['./research-project-pane.component.scss'],
})
export class ResearchProjectPaneComponent implements OnInit {
  @Input() model: ResearchModel;
  @Input() isReversed: boolean = false;

  constructor() {}

  ngOnInit(): void {}

  get containerClassStr(): string {
    let classStr: string = 'row research-pane';
    if (this.isReversed) {
      classStr += ' flex-row-reverse';
    }
    return classStr;
  }
}
