import { Component, OnInit } from '@angular/core';
import { APIResearchResponseModel } from 'src/app/global/interfaces/generated/research';
import { LoggerService } from 'src/app/global/services/logger.service';
import { ResearchService } from '../research.service';
import { ResearchPageModel } from './research-page-model';

@Component({
  selector: 'nds-research-page',
  templateUrl: './research-page.component.html',
  styleUrls: ['./research-page.component.scss'],
})
export class ResearchPageComponent implements OnInit {
  model: ResearchPageModel;

  constructor(
    private researchService: ResearchService,
    private log: LoggerService
  ) {}

  ngOnInit(): void {
    this.researchService.getResearch().subscribe(
      (research: APIResearchResponseModel) => {
        this.model = new ResearchPageModel(research);
      },
      (error: Error) => {
        this.log.exception(error, 'Error getting research');
      }
    );
  }
}
