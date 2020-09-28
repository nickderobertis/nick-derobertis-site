import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'nds-timeline-pane',
  templateUrl: './timeline-pane.component.html',
  styleUrls: ['./timeline-pane.component.scss'],
})
export class TimelinePaneComponent implements OnInit {
  loading: boolean = false; // TODO: get and use stats, then loading becomes useful

  constructor() {}

  ngOnInit(): void {}
}
