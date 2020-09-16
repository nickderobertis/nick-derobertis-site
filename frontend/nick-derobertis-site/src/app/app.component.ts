import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { EventService } from './global/services/event.service';

declare let gtag: Function;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'nick-derobertis-site';

  constructor(public router: Router, private eventService: EventService) {
    // subscribe to router events and send page views to Google Analytics
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.eventService.pageView(event.urlAfterRedirects);
      }
    });
  }
}
