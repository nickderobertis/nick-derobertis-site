import { APICourseTopicModel } from 'src/app/global/interfaces/generated/courses';

export class CourseTopicModel {
  title: string;
  logoSvgText?: string;
  logoFaIconClassStr?: string;
  children?: CourseTopicModel[];

  constructor(args: APICourseTopicModel) {
    this.title = args.title;
    if (args.logo_svg_text) {
      this.logoSvgText = args.logo_svg_text;
    }
    if (args.logo_fa_icon_class_str) {
      this.logoFaIconClassStr = args.logo_fa_icon_class_str;
    }
    if (args.children) {
      this.children = CourseTopicModel.arrFromAPIArr(args.children);
    }
  }

  static arrFromAPIArr(args: APICourseTopicModel[]): CourseTopicModel[] {
    const models: CourseTopicModel[] = [];
    for (const arg of args) {
      const mod = new CourseTopicModel(arg);
      models.push(mod);
    }
    return models;
  }
}
