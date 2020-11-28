import { APISkillModel } from 'src/app/global/interfaces/generated/skills';

export class SkillModel {
  title: string;
  level: number;
  directParentTitle?: string;

  constructor(args: APISkillModel) {
    this.title = args.title;
    this.level = args.level;
    if (args.direct_parent_title) {
      this.directParentTitle = args.direct_parent_title;
    }
  }

  static arrayFromAPIArray(skills: APISkillModel[]): SkillModel[] {
    const modelArr: SkillModel[] = [];
    for (const skill of skills) {
      const mod = new SkillModel(skill);
      modelArr.push(mod);
    }
    return modelArr;
  }
}
