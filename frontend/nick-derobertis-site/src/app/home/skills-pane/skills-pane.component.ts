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

  get description(): string {
    const browse: string = `Browse ${this.model?.count} skills in ${this.model?.parentCount} categories. `;
    let use: string;
    let switching: string;
    if (this.shouldShowChart) {
      use = 'Click inner categories in the chart to zoom in and out, ';
      switching = 'or click the button below to switch to a dropdown view';
    } else if (this.shouldShowDropdowns) {
      use = 'Click the dropdowns to see nested skills, ';
      switching =
        'or click the button below to switch to a sunburst chart view';
    } else {
      throw new Error(`Unknown selected component ${this.selectedComponent}`);
    }

    return browse + use + switching + '.';
  }

  changeActiveComponent(name: ValueOf<SkillsComponents>): void {
    this.selectedComponent = name;
  }
}
