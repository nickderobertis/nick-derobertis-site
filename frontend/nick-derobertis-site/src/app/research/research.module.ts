import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResearchPageComponent } from './research-page/research-page.component';
import { ResearchBannerComponent } from './research-banner/research-banner.component';



@NgModule({
  declarations: [ResearchPageComponent, ResearchBannerComponent],
  imports: [
    CommonModule
  ]
})
export class ResearchModule { }
