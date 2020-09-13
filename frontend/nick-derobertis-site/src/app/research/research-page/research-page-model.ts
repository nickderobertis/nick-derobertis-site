import { APIResearchResponseModel } from 'src/app/global/interfaces/generated/research';
import { ResearchModel } from '../research-project-pane/research-model';

export class ResearchPageModel {
  workingPapers: ResearchModel[];
  worksInProgress: ResearchModel[];

  constructor(args: APIResearchResponseModel) {
    this.workingPapers = ResearchModel.arrFromAPIArr(args.working_papers);
    this.worksInProgress = ResearchModel.arrFromAPIArr(args.works_in_progress);
  }

  get allResearch(): ResearchModel[] {
    return this.workingPapers.concat(this.worksInProgress);
  }
}
