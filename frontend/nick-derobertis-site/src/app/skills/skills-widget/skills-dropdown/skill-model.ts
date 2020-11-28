import { APISkillModel } from 'src/app/global/interfaces/generated/skills';

export class SkillModel {
  title: string;
  level: number;
  directParentTitle?: string;
  levelNames: { [level: number]: string } = {
    1: 'Have Used',
    2: 'Some Experience',
    3: 'Moderate Experience',
    4: 'Experienced',
    5: 'Highly Experienced',
  };

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

  get levelName(): string {
    return this.levelNames[this.level];
  }
}
