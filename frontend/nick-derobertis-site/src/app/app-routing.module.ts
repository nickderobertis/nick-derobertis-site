import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CoursesPageComponent } from './courses/courses-page/courses-page.component';
import { HomePageComponent } from './home/home-page/home-page.component';
import { ResearchPageComponent } from './research/research-page/research-page.component';
import { SoftwarePageComponent } from './software/software-page/software-page.component';
import { StoryPageComponent } from './story/story-page/story-page.component';

const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
  },
  {
    path: 'bio',
    component: StoryPageComponent,
  },
  {
    path: 'story',
    redirectTo: 'bio',
  },
  {
    path: 'research',
    component: ResearchPageComponent,
  },
  {
    path: 'software',
    component: SoftwarePageComponent,
  },
  {
    path: 'courses',
    component: CoursesPageComponent,
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      initialNavigation: 'enabled',
      anchorScrolling: 'enabled',
      scrollPositionRestoration: 'enabled',
      scrollOffset: [0, 64],
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
