import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkillsWidgetComponent } from './skills-widget/skills-widget.component';
import { SkillsDropdownComponent } from './skills-widget/skills-dropdown/skills-dropdown.component';
import { SkillsService } from './skills.service';
import { GlobalModule } from '../global/global.module';
import { LoggerService } from '../global/services/logger.service';
import { SkillsChartComponent } from './skills-chart/skills-chart.component';

@NgModule({
  declarations: [
    SkillsWidgetComponent,
    SkillsDropdownComponent,
    SkillsChartComponent,
  ],
  imports: [CommonModule, GlobalModule],
  providers: [SkillsService, LoggerService],
  exports: [SkillsWidgetComponent, SkillsChartComponent],
})
export class SkillsModule {}
