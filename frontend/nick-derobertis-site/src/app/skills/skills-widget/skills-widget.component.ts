import { Component, OnInit, QueryList, ViewChildren } from '@angular/core';
import { APISkillModel } from 'src/app/global/interfaces/generated/skills';
import { LoggerService } from 'src/app/global/services/logger.service';
import { SkillsService } from '../skills.service';
import { SkillDropdownModel } from './skills-dropdown/skill-dropdown-model';
import { SkillModel } from './skills-dropdown/skill-model';
import { SkillsDropdownComponent } from './skills-dropdown/skills-dropdown.component';

@Component({
  selector: 'nds-skills-widget',
  templateUrl: './skills-widget.component.html',
  styleUrls: ['./skills-widget.component.scss'],
})
export class SkillsWidgetComponent implements OnInit {
  parentSkills: SkillModel[] = [];
  parentSkillDropdowns: SkillDropdownModel[] = [];

  constructor(
    private skillsService: SkillsService,
    private log: LoggerService
  ) {}

  ngOnInit(): void {
    this.skillsService.getParentSkills().subscribe(
      (res: APISkillModel[]) => {
        this.setParentSkills(res);
      },
      (error: Error) => {
        this.log.exception(error, 'Error getting parent skills');
      }
    );
  }

  setParentSkills(skills: APISkillModel[]): void {
    this.parentSkills = SkillModel.arrayFromAPIArray(skills);
    this.parentSkillDropdowns = this.getSkillDropdownModels();
  }

  getSkillDropdownModels(): SkillDropdownModel[] {
    return SkillDropdownModel.arrFromSkillModelArr(
      this.parentSkills,
      undefined,
      false
    );
  }
}
