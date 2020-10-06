import { Component, OnInit } from '@angular/core';
import { AwardModel } from 'src/app/awards/award-card/award-model';
import { AwardService } from 'src/app/awards/award.service';
import { APIAwardModel } from 'src/app/global/interfaces/generated/awards';
import { LoggerService } from 'src/app/global/services/logger.service';

@Component({
  selector: 'nds-awards-pane',
  templateUrl: './awards-pane.component.html',
  styleUrls: ['./awards-pane.component.scss'],
})
export class AwardsPaneComponent implements OnInit {
  models: AwardModel[] = [];

  constructor(private awardService: AwardService, private log: LoggerService) {}

  ngOnInit(): void {
    this.awardService.getAwards().subscribe(
      (awards: APIAwardModel[]) => {
        this.models = AwardModel.arrFromArgsArr(awards);
      },
      (error: Error) => {
        this.log.exception(error, 'Error getting awards');
      }
    );
  }
}
