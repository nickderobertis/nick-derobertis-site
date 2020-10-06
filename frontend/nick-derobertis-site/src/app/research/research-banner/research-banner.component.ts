import { Component, OnInit } from '@angular/core';
import { EventTypes } from 'src/app/global/classes/event-types';
import { FilePaths } from 'src/app/global/enums/file-paths.enum';
import { IEvent } from 'src/app/global/services/events/i-event';

@Component({
  selector: 'nds-research-banner',
  templateUrl: './research-banner.component.html',
  styleUrls: ['./research-banner.component.scss'],
})
export class ResearchBannerComponent implements OnInit {
  viewCVEvent: IEvent = EventTypes.viewCV;
  cvPath: string = FilePaths.CV;

  constructor() {}

  ngOnInit(): void {}
}
