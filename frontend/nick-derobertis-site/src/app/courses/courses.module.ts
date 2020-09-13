import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoursesPageComponent } from './courses-page/courses-page.component';
import { CoursesBannerComponent } from './courses-banner/courses-banner.component';



@NgModule({
  declarations: [CoursesPageComponent, CoursesBannerComponent],
  imports: [
    CommonModule
  ]
})
export class CoursesModule { }
