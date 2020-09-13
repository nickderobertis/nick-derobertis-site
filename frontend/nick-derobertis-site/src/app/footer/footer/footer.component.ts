import { Component, OnInit } from '@angular/core';
import { copyright } from 'src/app/global/classes/copyright';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'nds-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent implements OnInit {
  copyright: string = copyright.str;
  apiDocsUrl: string = `${environment.apiUrl}/docs`;

  constructor() {}

  ngOnInit(): void {}

  scrollToTop(event: MouseEvent): void {
    window.scrollTo(0, 0);
  }
}
