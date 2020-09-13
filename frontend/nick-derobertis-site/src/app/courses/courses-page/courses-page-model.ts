import { APICourseModel } from 'src/app/global/interfaces/generated/courses';
import { CoursePaneModel } from '../course-pane/course-pane-model';

export class CoursesPageModel {
  courseModels: CoursePaneModel[] = [];

  constructor(args: APICourseModel[]) {
    this.courseModels = CoursePaneModel.arrFromAPIArr(args);
  }
}
