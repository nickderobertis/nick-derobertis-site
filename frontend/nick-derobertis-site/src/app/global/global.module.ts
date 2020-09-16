import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { SafeHtmlPipe } from './pipes/safe-html.pipe';
import { GoogleAnalyticsGTagComponent } from './components/google-analytics-gtag/google-analytics-gtag.component';

@NgModule({
  declarations: [
    LoadingSpinnerComponent,
    SafeHtmlPipe,
    GoogleAnalyticsGTagComponent,
  ],
  imports: [CommonModule],
  exports: [
    LoadingSpinnerComponent,
    SafeHtmlPipe,
    GoogleAnalyticsGTagComponent,
  ],
})
export class GlobalModule {}
