import { APISkillModel } from 'src/app/global/interfaces/generated/skills';
import { SkillModel } from '../skills-widget/skills-dropdown/skill-model';
import { SunburstArgs } from './sunburst-args';
import { SunburstData } from './sunburst-data';

export class SkillChartModel {
  skills: SkillModel[];

  constructor(args: SkillModel[]) {
    this.skills = args;
  }

  static fromAPIArray(skills: APISkillModel[]): SkillChartModel {
    const skillModels = SkillModel.arrayFromAPIArray(skills);
    return new SkillChartModel(skillModels);
  }

  toChartArgs(): SunburstArgs {
    const labels: string[] = [];
    const parents: string[] = [];
    const values: number[] = [];

    for (const skill of this.skills) {
      labels.push(skill.title);
      values.push(skill.level);
      if (skill.directParentTitle) {
        parents.push(skill.directParentTitle);
      } else {
        parents.push('');
      }
    }
    const data: SunburstData[] = [
      {
        type: 'sunburst',
        labels,
        parents,
        values,
      },
    ];
    const args: SunburstArgs = {
      data,
      layout: {
        paper_bgcolor: '#f1e9e9',
        plot_bgcolor: '#f1e9e9',
        margin: { l: 0, r: 0, t: 0, b: 0 },
        height: 700,
      },
      options: {
        responsive: true,
      },
    };
    return args;
  }
}
