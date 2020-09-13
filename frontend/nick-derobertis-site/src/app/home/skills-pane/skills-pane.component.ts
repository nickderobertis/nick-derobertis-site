import { Component, OnInit } from '@angular/core';
import { APISkillStatisticsModel } from 'src/app/global/interfaces/generated/skills';
import { SkillsService } from 'src/app/skills/skills.service';
import { SkillStatisticsModel } from './skill-statistics-model';

@Component({
  selector: 'nds-skills-pane',
  templateUrl: './skills-pane.component.html',
  styleUrls: ['./skills-pane.component.scss'],
})
export class SkillsPaneComponent implements OnInit {
  model: SkillStatisticsModel;
  loading: boolean = true;

  constructor(private skillsService: SkillsService) {}

  ngOnInit(): void {
    this.skillsService
      .getStatistics()
      .subscribe((stats: APISkillStatisticsModel) => {
        this.model = new SkillStatisticsModel(stats);
        this.loading = false;
      });
  }
}
