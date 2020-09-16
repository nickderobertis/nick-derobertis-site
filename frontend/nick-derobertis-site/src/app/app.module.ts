import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderModule } from './header/header.module';
import { FooterModule } from './footer/footer.module';
import { HomeModule } from './home/home.module';
import { StoryModule } from './story/story.module';
import { ResearchModule } from './research/research.module';
import { SoftwareModule } from './software/software.module';
import { CoursesModule } from './courses/courses.module';
import { HttpClientModule } from '@angular/common/http';
import { GlobalModule } from './global/global.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule.withServerTransition({ appId: 'serverApp' }),
    AppRoutingModule,
    HttpClientModule,
    HeaderModule,
    FooterModule,
    HomeModule,
    StoryModule,
    ResearchModule,
    SoftwareModule,
    CoursesModule,
    GlobalModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
