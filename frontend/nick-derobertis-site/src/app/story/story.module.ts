import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoryPageComponent } from './story-page/story-page.component';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [StoryPageComponent],
  imports: [CommonModule, RouterModule],
})
export class StoryModule {}
