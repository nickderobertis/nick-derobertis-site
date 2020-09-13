import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SoftwarePageComponent } from './software-page/software-page.component';
import { SoftwareBannerComponent } from './software-banner/software-banner.component';



@NgModule({
  declarations: [SoftwarePageComponent, SoftwareBannerComponent],
  imports: [
    CommonModule
  ]
})
export class SoftwareModule { }
