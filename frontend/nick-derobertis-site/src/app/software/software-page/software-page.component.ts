import { Component, OnInit } from '@angular/core';
import { APISoftwareModel } from 'src/app/global/interfaces/generated/software';
import { SoftwareService } from '../software.service';
import { SoftwarePageModel } from './software-page-model';

@Component({
  selector: 'nds-software-page',
  templateUrl: './software-page.component.html',
  styleUrls: ['./software-page.component.scss'],
})
export class SoftwarePageComponent implements OnInit {
  model: SoftwarePageModel;

  constructor(private softwareService: SoftwareService) {}

  ngOnInit(): void {
    this.softwareService
      .getSoftware()
      .subscribe((software: APISoftwareModel[]) => {
        this.model = new SoftwarePageModel(software);
      });
  }
}
