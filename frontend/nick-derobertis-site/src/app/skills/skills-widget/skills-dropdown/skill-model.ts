import { numberWithCommas } from 'src/app/global/functions/text';
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
  experienceLength?: string;
  priorities: Priorities;
  levelNames: { [level: number]: string } = {
    1: 'Have Used',
    2: 'Some Aptitude',
    3: 'Moderate Aptitude',
    4: 'Moderately High Aptitude',
    5: 'High Aptitude',
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
    if (args.experience_length_str) {
      this.experienceLength = args.experience_length_str;
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

  get info(): string[] {
    const includedInfo: string[] = [this.levelName];
    if (this.hours) {
      includedInfo.push(
        'Est. Hours: ' + numberWithCommas(Math.round(this.hours))
      );
    }
    if (this.experienceLength) {
      includedInfo.push('First used: ' + this.experienceLength + ' ago');
    }
    return includedInfo;
  }

  get infoStr(): string {
    let info = '';
    for (const infoItem of this.info) {
      info += infoItem;
      info += '<br>';
    }
    info = info.slice(0, -4); // remove final line break
    return info;
  }
}
