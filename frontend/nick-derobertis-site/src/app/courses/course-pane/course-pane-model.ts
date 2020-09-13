import { APICourseModel } from 'src/app/global/interfaces/generated/courses';
import { SoftwareProjectModel } from 'src/app/software/software-card/software-project-model';
import { CourseTopicModel } from './course-topic-model';
import { UniversityModel } from './university-model';

export class CoursePaneModel {
  title: string;
  description: string;
  periodsTaught: string[] = [];
  evaluationScore?: number;
  evaluationMaxScore: number = 5;
  university?: UniversityModel;
  courseId?: string;
  instructor?: string;
  instructorEmail?: string;
  topics?: CourseTopicModel[] = [];
  currentPeriod?: string;
  currentTime?: string;
  websiteUrl?: string;
  softwareProjects?: SoftwareProjectModel[];
  pdfName?: string;

  constructor(args: APICourseModel) {
    this.title = args.title;
    this.description = args.description;
    if (args.periods_taught) {
      this.periodsTaught = args.periods_taught;
    }
    if (args.evaluation_score) {
      this.evaluationScore = args.evaluation_score;
    }
    if (args.evaluation_max_score) {
      this.evaluationMaxScore = args.evaluation_max_score;
    }
    if (args.university) {
      this.university = new UniversityModel(args.university);
    }
    if (args.course_id) {
      this.courseId = args.course_id;
    }
    if (args.instructor) {
      this.instructor = args.instructor;
    }
    if (args.instructor_email) {
      this.instructorEmail = args.instructor_email;
    }
    if (args.topics) {
      this.topics = CourseTopicModel.arrFromAPIArr(args.topics);
    }
    if (args.current_period) {
      this.currentPeriod = args.current_period;
    }
    if (args.current_time) {
      this.currentTime = args.current_time;
    }
    if (args.website_url) {
      this.websiteUrl = args.website_url;
    }
    if (args.software_projects) {
      this.softwareProjects = SoftwareProjectModel.arrFromAPIArr(
        args.software_projects
      );
    }
    if (args.pdf_name) {
      this.pdfName = args.pdf_name;
    }
  }

  get pdfPath(): string {
    if (!this.pdfName) {
      return;
    }

    return `assets/images/pdfs/generated/${this.pdfName}`;
  }

  static arrFromAPIArr(args: APICourseModel[]): CoursePaneModel[] {
    const models: CoursePaneModel[] = [];
    for (const arg of args) {
      const mod = new CoursePaneModel(arg);
      models.push(mod);
    }
    return models;
  }
}
