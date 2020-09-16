import { Component, OnInit } from '@angular/core';
import { EventTypes } from 'src/app/global/classes/event-types';
import { IEvent } from 'src/app/global/services/events/i-event';

@Component({
  selector: 'nds-software-banner',
  templateUrl: './software-banner.component.html',
  styleUrls: ['./software-banner.component.scss'],
})
export class SoftwareBannerComponent implements OnInit {
  viewGithubEvent: IEvent = EventTypes.viewGithub;

  constructor() {}

  ngOnInit(): void {}
}
