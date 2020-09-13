import { SkillModel } from './skill-model';

export interface ISkillDropdownModel {
  skill: SkillModel;
  childSkills: SkillModel[];
  loadChildren: boolean;
  isChild: boolean;
}
