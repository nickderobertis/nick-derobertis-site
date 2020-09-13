import { APISoftwareModel } from 'src/app/global/interfaces/generated/software';
import { SoftwareProjectModel } from '../software-card/software-project-model';

export class SoftwarePageModel {
  projectModels: SoftwareProjectModel[] = [];

  constructor(args: APISoftwareModel[]) {
    this.projectModels = SoftwareProjectModel.arrFromAPIArr(args);
  }
}
