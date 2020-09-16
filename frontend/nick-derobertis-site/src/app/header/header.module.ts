import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './header/header.component';
import { RouterModule } from '@angular/router';
import { GlobalModule } from '../global/global.module';

@NgModule({
  declarations: [HeaderComponent],
  imports: [CommonModule, RouterModule, GlobalModule],
  exports: [HeaderComponent],
})
export class HeaderModule {}
