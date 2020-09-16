import { IItem } from 'src/app/global/services/events/i-item';
import { ISkillDropdownModel } from './i-skill-dropdown-model';
import { SkillModel } from './skill-model';

export class SkillDropdownModel implements ISkillDropdownModel {
  skill: SkillModel;
  childSkills: SkillModel[];
  loadChildren: boolean;
  isChild: boolean;
  childrensChildrenHaveBeenLoaded: boolean;
  hasBeenOpened: boolean = false;

  constructor(args: ISkillDropdownModel) {
    this.skill = args.skill;
    this.childSkills = args.childSkills;
    this.loadChildren = args.loadChildren;
    this.isChild = args.isChild;
    this.childrensChildrenHaveBeenLoaded = false;
  }

  static fromSkillModel(
    skill: SkillModel,
    childSkills: SkillModel[] = [],
    loadChildren: boolean = true,
    isChild: boolean = true
  ): SkillDropdownModel {
    const args: ISkillDropdownModel = {
      skill,
      childSkills,
      loadChildren,
      isChild,
    };
    return new SkillDropdownModel(args);
  }

  static arrFromSkillModelArr(
    skills: SkillModel[],
    loadChildren: boolean = true,
    areChildren: boolean = true
  ): SkillDropdownModel[] {
    const models: SkillDropdownModel[] = [];
    for (const skill of skills) {
      const mod: SkillDropdownModel = SkillDropdownModel.fromSkillModel(
        skill,
        undefined,
        loadChildren,
        areChildren
      );
      models.push(mod);
    }
    return models;
  }

  get hasChildren(): boolean {
    return this.childSkills.length > 0;
  }

  get eventItem(): IItem {
    return {
      id: this.skill.title,
      name: this.skill.title,
      variant: this.skill.level.toString(),
      category: 'Skill',
    };
  }
}
