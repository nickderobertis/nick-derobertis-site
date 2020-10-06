import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isTouchDevice } from 'src/app/global/functions/browser';

@Component({
  selector: 'nds-timeline-pane',
  templateUrl: './timeline-pane.component.html',
  styleUrls: ['./timeline-pane.component.scss'],
})
export class TimelinePaneComponent implements OnInit {
  loading: boolean = false; // TODO: get and use stats, then loading becomes useful
  actionWord: string = 'Hover over';

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId) && isTouchDevice()) {
      this.actionWord = 'Tap';
    }
  }
}
