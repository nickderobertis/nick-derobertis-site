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

@NgModule({
  declarations: [
    HomePageComponent,
    HomeCarouselComponent,
    HomeCarouselItemComponent,
    HomeCardComponent,
    HomeStoryComponent,
    SkillsPaneComponent,
    AwardsPaneComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    SkillsModule,
    GlobalModule,
    AwardsModule,
  ],
  exports: [HomePageComponent],
  providers: [SkillsService, AwardService],
})
export class HomeModule {}
