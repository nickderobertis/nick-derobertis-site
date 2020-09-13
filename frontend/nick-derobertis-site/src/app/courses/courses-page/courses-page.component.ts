import { Component, OnInit } from '@angular/core';
import { APICourseModel } from 'src/app/global/interfaces/generated/courses';
import { CourseService } from '../course.service';
import { CoursesPageModel } from './courses-page-model';

@Component({
  selector: 'nds-courses-page',
  templateUrl: './courses-page.component.html',
  styleUrls: ['./courses-page.component.scss'],
})
export class CoursesPageComponent implements OnInit {
  model: CoursesPageModel;

  constructor(private courseService: CourseService) {}

  ngOnInit(): void {
    this.courseService.getCourses().subscribe((courses: APICourseModel[]) => {
      this.model = new CoursesPageModel(courses);
    });
  }
}
