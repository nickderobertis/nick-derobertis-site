import { Component, OnInit } from '@angular/core';
import { APISkillStatisticsModel } from 'src/app/global/interfaces/generated/skills';
import { LoggerService } from 'src/app/global/services/logger.service';
import { SkillsService } from 'src/app/skills/skills.service';
import { SkillStatisticsModel } from './skill-statistics-model';
import { SkillsComponents } from './skills-components.enum';

type ValueOf<T> = T[keyof T];

@Component({
  selector: 'nds-skills-pane',
  templateUrl: './skills-pane.component.html',
  styleUrls: ['./skills-pane.component.scss'],
})
export class SkillsPaneComponent implements OnInit {
  model: SkillStatisticsModel;
  loading: boolean = true;
  selectedComponent: ValueOf<SkillsComponents> = 'chart';

  constructor(
    private skillsService: SkillsService,
    private log: LoggerService
  ) {}

  ngOnInit(): void {
    this.skillsService.getStatistics().subscribe(
      (stats: APISkillStatisticsModel) => {
        this.model = new SkillStatisticsModel(stats);
        this.loading = false;
      },
      (error: Error) => {
        this.log.exception(error, 'Error getting skill statistics');
      }
    );
  }

  get shouldShowChart(): boolean {
    return this.selectedComponent === SkillsComponents.CHART;
  }

  get chartStyles(): { [key: string]: string } {
    if (this.shouldShowChart) {
      return {};
    } else {
      return { display: 'none' };
    }
  }

  get shouldShowDropdowns(): boolean {
    return this.selectedComponent === SkillsComponents.DROPDOWNS;
  }

  get dropdownStyles(): { [key: string]: string } {
    if (this.shouldShowDropdowns) {
      return {};
    } else {
      return { display: 'none' };
    }
  }

  changeActiveComponent(name: ValueOf<SkillsComponents>): void {
    this.selectedComponent = name;
  }
}
