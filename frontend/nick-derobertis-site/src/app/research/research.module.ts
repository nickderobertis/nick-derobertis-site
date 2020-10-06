import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResearchPageComponent } from './research-page/research-page.component';
import { ResearchBannerComponent } from './research-banner/research-banner.component';
import { ResearchProjectPaneComponent } from './research-project-pane/research-project-pane.component';
import { ResearchCategoryComponent } from './research-category/research-category.component';
import { GlobalModule } from '../global/global.module';
import { ResearchService } from './research.service';
import { LoggerService } from '../global/services/logger.service';

@NgModule({
  declarations: [
    ResearchPageComponent,
    ResearchBannerComponent,
    ResearchProjectPaneComponent,
    ResearchCategoryComponent,
  ],
  imports: [CommonModule, GlobalModule],
  providers: [ResearchService, LoggerService],
})
export class ResearchModule {}
