import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FooterComponent } from './footer/footer.component';
import { GlobalModule } from '../global/global.module';

@NgModule({
  declarations: [FooterComponent],
  imports: [CommonModule, GlobalModule],
  exports: [FooterComponent],
})
export class FooterModule {}
