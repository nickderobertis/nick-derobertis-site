import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

declare let gtag: Function;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'nick-derobertis-site';

  constructor(
    public router: Router,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {
    // subscribe to router events and send page views to Google Analytics
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        if (isPlatformBrowser(this.platformId)) {
          gtag('event', 'page_view', {
            page_path: event.urlAfterRedirects,
          });
        }
      }
    });
  }
}
