import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkillsWidgetComponent } from './skills-widget/skills-widget.component';
import { SkillsDropdownComponent } from './skills-widget/skills-dropdown/skills-dropdown.component';
import { SkillsService } from './skills.service';
import { GlobalModule } from '../global/global.module';

@NgModule({
  declarations: [SkillsWidgetComponent, SkillsDropdownComponent],
  imports: [CommonModule, GlobalModule],
  providers: [SkillsService],
  exports: [SkillsWidgetComponent],
})
export class SkillsModule {}
