import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
} from '@angular/core';
import { EventTypes } from 'src/app/global/classes/event-types';
import { personalDetails } from 'src/app/global/classes/personal-details';
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
  viewLinkedInEvent: IEvent = EventTypes.viewLinkedIn;
  viewEmailEvent: IEvent = EventTypes.sendMeEmail;
  viewPhoneEvent: IEvent = EventTypes.viewPhone;
  personalDetails = personalDetails;
  dropdownOpen: boolean = false;
  emailTooltip: HTMLSpanElement;

  constructor(private el: ElementRef) {}

  ngOnInit(): void {}

  @HostListener('document:click', ['$event.target'])
  outsideClick(element: HTMLElement): void {
    // Close dropdown when clicking outside header
    if (!this.el.nativeElement.contains(element)) {
      this.closeDropdown();
    }

    // Close tooltips when clicking outside their buttons
    if (element.classList.contains('fa-envelope')) {
      this.closePhoneTooltip();
    }

    if (element.classList.contains('fa-phone')) {
      this.closeEmailTooltip();
    }

    if (
      !Boolean(element.closest('.tooltip-inner')) &&
      !element.classList.contains('fa-envelope') &&
      !element.classList.contains('fa-phone')
    ) {
      this.closeTooltips();
    }
  }

  closeDropdown(): void {
    $('.navbar-collapse').collapse('hide');
  }

  closeTooltips(): void {
    this.closeEmailTooltip();
    this.closePhoneTooltip();
  }

  closeEmailTooltip(): void {
    $('#header-email-button').tooltip('hide');
  }

  closePhoneTooltip(): void {
    $('#header-phone-button').tooltip('hide');
  }

  get emailToolTipHTML(): string {
    return `
    <span class="header-email-tooltip">
      <a
        href="mailto:${this.personalDetails.email}"
      >
        <i class="fas fa-envelope fa-lg"></i>
      </a>
      <span class="p-1"></span>
      <span>
        ${this.personalDetails.email}
      </span>
    </span>
    `;
  }

  get phoneToolTipHTML(): string {
    return `
    <span class="header-phone-tooltip">
      <a
        href="${this.personalDetails.phoneNumberTelLink}"
      >
        <i class="fas fa-phone fa-lg"></i>
        <span class="p-1"></span>
        <span class="text-white">
          ${this.personalDetails.phoneNumberDisplay}
        </span>
      </a>
    </span>
    `;
  }
}
