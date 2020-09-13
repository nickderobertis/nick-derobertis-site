import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SoftwarePageComponent } from './software-page/software-page.component';
import { SoftwareBannerComponent } from './software-banner/software-banner.component';
import { SoftwareCardComponent } from './software-card/software-card.component';
import { GlobalModule } from '../global/global.module';
import { SoftwareService } from './software.service';

@NgModule({
  declarations: [
    SoftwarePageComponent,
    SoftwareBannerComponent,
    SoftwareCardComponent,
  ],
  imports: [CommonModule, GlobalModule],
  providers: [SoftwareService],
  exports: [SoftwareCardComponent],
})
export class SoftwareModule {}
