import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { EventTypes } from 'src/app/global/classes/event-types';
import { FilePaths } from 'src/app/global/enums/file-paths.enum';
import { PageLink } from 'src/app/global/interfaces/page-link';
import { IEvent } from 'src/app/global/services/events/i-event';

declare const $;

@Component({
  selector: 'nds-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  routerLinks: PageLink[] = [
    {
      link: '',
      title: 'Home',
    },
    {
      link: 'bio',
      title: 'bio',
    },
    {
      link: 'research',
      title: 'Research',
    },
    {
      link: 'software',
      title: 'Software',
    },
    {
      link: 'courses',
      title: 'Courses',
    },
  ];
  // TODO: better structure for header links now that CV has specific event
  normalLinks: PageLink[] = [
    {
      link: FilePaths.CV,
      title: 'CV',
    },
  ];
  viewCVEvent: IEvent = EventTypes.viewCV;
  viewGithubEvent: IEvent = EventTypes.viewGithub;
  dropdownOpen: boolean = false;

  constructor(private el: ElementRef) {}

  ngOnInit(): void {}

  @HostListener('document:click', ['$event'])
  outsideClick(event: MouseEvent): void {
    if (this.el.nativeElement.contains(event.target)) {
      return;
    }
    // Close dropdown when clicking outside header
    this.closeDropdown();
  }

  closeDropdown(): void {
    $('.navbar-collapse').collapse('hide');
  }
}
