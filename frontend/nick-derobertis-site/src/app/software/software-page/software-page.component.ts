import { Component, OnInit } from '@angular/core';
import { APISoftwareModel } from 'src/app/global/interfaces/generated/software';
import { LoggerService } from 'src/app/global/services/logger.service';
import { SoftwareService } from '../software.service';
import { SoftwarePageModel } from './software-page-model';

@Component({
  selector: 'nds-software-page',
  templateUrl: './software-page.component.html',
  styleUrls: ['./software-page.component.scss'],
})
export class SoftwarePageComponent implements OnInit {
  model: SoftwarePageModel;

  constructor(
    private softwareService: SoftwareService,
    private log: LoggerService
  ) {}

  ngOnInit(): void {
    this.softwareService.getSoftware().subscribe(
      (software: APISoftwareModel[]) => {
        this.model = new SoftwarePageModel(software);
      },
      (error: Error) => {
        this.log.exception(error, 'Error getting software');
      }
    );
  }
}
