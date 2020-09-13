import { Component, OnInit } from '@angular/core';
import { APISkillModel } from 'src/app/global/interfaces/generated/skills';
import { SkillsService } from '../skills.service';
import { SkillDropdownModel } from './skills-dropdown/skill-dropdown-model';
import { SkillModel } from './skills-dropdown/skill-model';

@Component({
  selector: 'nds-skills-widget',
  templateUrl: './skills-widget.component.html',
  styleUrls: ['./skills-widget.component.scss'],
})
export class SkillsWidgetComponent implements OnInit {
  parentSkills: SkillModel[] = [];

  constructor(private skillsService: SkillsService) {}

  ngOnInit(): void {
    this.skillsService.getParentSkills().subscribe((res: APISkillModel[]) => {
      this.parentSkills = SkillModel.arrayFromAPIArray(res);
    });
  }

  get skillDropdownModels(): SkillDropdownModel[] {
    return SkillDropdownModel.arrFromSkillModelArr(this.parentSkills);
  }
}
