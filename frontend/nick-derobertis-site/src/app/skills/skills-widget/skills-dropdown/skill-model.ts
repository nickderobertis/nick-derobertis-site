import { APISkillModel } from 'src/app/global/interfaces/generated/skills';

export class SkillModel implements APISkillModel {
  title: string;
  level: number;

  constructor(args: APISkillModel) {
    this.title = args.title;
    this.level = args.level;
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
