import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AwardCardComponent } from './award-card/award-card.component';
import { GlobalModule } from '../global/global.module';

@NgModule({
  declarations: [AwardCardComponent],
  imports: [CommonModule, GlobalModule],
  exports: [AwardCardComponent],
})
export class AwardsModule {}
