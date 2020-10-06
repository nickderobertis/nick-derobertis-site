import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoursesPageComponent } from './courses-page/courses-page.component';
import { CoursesBannerComponent } from './courses-banner/courses-banner.component';
import { CoursePaneComponent } from './course-pane/course-pane.component';
import { GlobalModule } from '../global/global.module';
import { SoftwareModule } from '../software/software.module';
import { CourseService } from './course.service';
import { LoggerService } from '../global/services/logger.service';

@NgModule({
  declarations: [
    CoursesPageComponent,
    CoursesBannerComponent,
    CoursePaneComponent,
  ],
  imports: [CommonModule, GlobalModule, SoftwareModule],
  providers: [CourseService, LoggerService],
})
export class CoursesModule {}
