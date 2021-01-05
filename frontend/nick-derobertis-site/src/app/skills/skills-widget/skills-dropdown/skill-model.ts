import {
  APISkillModel,
  ApplicationFocus,
  SpecificApplicationFocus,
} from 'src/app/global/interfaces/generated/skills';

export type AllApplicationFocus = ApplicationFocus | SpecificApplicationFocus;
type Priorities = { [focus in AllApplicationFocus]: number };

export class SkillModel {
  title: string;
  level: number;
  directParentTitle?: string;
  hours?: number;
  firstUsed?: Date;
  priorities: Priorities;
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
    this.priorities = args.priorities as Priorities;
    if (args.direct_parent_title) {
      this.directParentTitle = args.direct_parent_title;
    }
    if (args.hours) {
      this.hours = args.hours;
    }
    if (args.first_used) {
      this.firstUsed = new Date(args.first_used);
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
