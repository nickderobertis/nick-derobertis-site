import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { SafeHtmlPipe } from './pipes/safe-html.pipe';
import { GoogleAnalyticsGTagComponent } from './components/google-analytics-gtag/google-analytics-gtag.component';
import { ClickEventDirective } from './directives/click-event.directive';
import { AppShellRenderDirective } from './directives/app-shell-render.directive';
import { AppShellNoRenderDirective } from './directives/app-shell-no-render.directive';

@NgModule({
  declarations: [
    LoadingSpinnerComponent,
    SafeHtmlPipe,
    GoogleAnalyticsGTagComponent,
    ClickEventDirective,
    AppShellRenderDirective,
    AppShellNoRenderDirective,
  ],
  imports: [CommonModule],
  exports: [
    LoadingSpinnerComponent,
    SafeHtmlPipe,
    GoogleAnalyticsGTagComponent,
    ClickEventDirective,
    AppShellRenderDirective,
    AppShellNoRenderDirective,
  ],
})
export class GlobalModule {}
