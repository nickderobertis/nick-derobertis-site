import { APISkillStatisticsModel } from 'src/app/global/interfaces/generated/skills';

export class SkillStatisticsModel {
  count: number;
  parentCount: number;

  constructor(args: APISkillStatisticsModel) {
    this.count = args.count;
    this.parentCount = args.parent_count;
  }
}
