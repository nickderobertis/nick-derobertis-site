import { ISkillDropdownModel } from './i-skill-dropdown-model';
import { SkillModel } from './skill-model';

export class SkillDropdownModel implements ISkillDropdownModel {
  skill: SkillModel;
  childSkills: SkillModel[];
  loadChildren: boolean;

  constructor(args: ISkillDropdownModel) {
    this.skill = args.skill;
    this.childSkills = args.childSkills;
    this.loadChildren = args.loadChildren;
  }

  static fromSkillModel(
    skill: SkillModel,
    childSkills: SkillModel[] = [],
    loadChildren: boolean = true
  ): SkillDropdownModel {
    const args: ISkillDropdownModel = {
      skill,
      childSkills,
      loadChildren,
    };
    return new SkillDropdownModel(args);
  }

  static arrFromSkillModelArr(
    skills: SkillModel[],
    loadChildren: boolean = true
  ): SkillDropdownModel[] {
    const models: SkillDropdownModel[] = [];
    for (const skill of skills) {
      const mod: SkillDropdownModel = SkillDropdownModel.fromSkillModel(
        skill,
        undefined,
        loadChildren
      );
      models.push(mod);
    }
    return models;
  }
}
