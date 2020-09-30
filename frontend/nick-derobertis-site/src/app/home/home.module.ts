import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomePageComponent } from './home-page/home-page.component';
import { HomeCarouselComponent } from './home-carousel/home-carousel.component';
import { HomeCarouselItemComponent } from './home-carousel/home-carousel-item/home-carousel-item.component';
import { RouterModule } from '@angular/router';
import { HomeCardComponent } from './home-card/home-card.component';
import { HomeStoryComponent } from './home-story/home-story.component';
import { SkillsPaneComponent } from './skills-pane/skills-pane.component';
import { SkillsService } from '../skills/skills.service';
import { SkillsModule } from '../skills/skills.module';
import { GlobalModule } from '../global/global.module';
import { AwardsPaneComponent } from './awards-pane/awards-pane.component';
import { AwardsModule } from '../awards/awards.module';
import { AwardService } from '../awards/award.service';
import { ContactPaneComponent } from './contact-pane/contact-pane.component';
import { TimelinePaneComponent } from './timeline-pane/timeline-pane.component';
import { TimelineWidgetComponent } from './timeline-pane/timeline-widget/timeline-widget.component';
import { TimelineService } from './timeline-pane/timeline.service';
import { GoogleChartsModule } from 'angular-google-charts';
import { FormsModule } from '@angular/forms';
import { CSSVariablesService } from '../global/services/css-variables.service';

@NgModule({
  declarations: [
    HomePageComponent,
    HomeCarouselComponent,
    HomeCarouselItemComponent,
    HomeCardComponent,
    HomeStoryComponent,
    SkillsPaneComponent,
    AwardsPaneComponent,
    ContactPaneComponent,
    TimelinePaneComponent,
    TimelineWidgetComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SkillsModule,
    GlobalModule,
    AwardsModule,
    GoogleChartsModule.forRoot({ version: 'current' }),
  ],
  exports: [HomePageComponent],
  providers: [
    SkillsService,
    AwardService,
    TimelineService,
    CSSVariablesService,
  ],
})
export class HomeModule {}
