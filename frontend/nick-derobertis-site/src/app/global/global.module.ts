import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { SafeHtmlPipe } from './pipes/safe-html.pipe';

@NgModule({
  declarations: [LoadingSpinnerComponent, SafeHtmlPipe],
  imports: [CommonModule],
  exports: [LoadingSpinnerComponent, SafeHtmlPipe],
})
export class GlobalModule {}
