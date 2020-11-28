import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import {
  Component,
  ElementRef,
  Inject,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { APISkillModel } from 'src/app/global/interfaces/generated/skills';
import { LoggerService } from 'src/app/global/services/logger.service';
import { SkillsService } from '../skills.service';
import { SkillChartModel } from './skill-chart-model';
import { SunburstArgs } from './sunburst-args';

declare const Plotly: any;

@Component({
  selector: 'nds-skills-chart',
  templateUrl: './skills-chart.component.html',
  styleUrls: ['./skills-chart.component.scss'],
})
export class SkillsChartComponent implements OnInit {
  @ViewChild('skillChart', { static: true }) skillChart: ElementRef;
  model: SkillChartModel;
  graph: SunburstArgs;

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: object,
    private skillsService: SkillsService,
    private log: LoggerService
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.getSkills();
    }
  }

  setBackgroundColor(): void {
    const bgColor: string = getComputedStyle(
      document.documentElement
    ).getPropertyValue('--background');
    this.graph.layout.paper_bgcolor = bgColor;
    this.graph.layout.plot_bgcolor = bgColor;
  }

  setHeight(): void {
    this.graph.layout.height = this.chartHeight;
  }

  adjustChartOptions(): void {
    this.setBackgroundColor();
    this.setHeight();
  }

  generateChart(): void {
    this.skillChart = Plotly.newPlot(
      this.skillChart.nativeElement,
      this.graph.data,
      this.graph.layout,
      this.graph.options
    );
  }

  getSkills(): void {
    this.skillsService.getAllSkills().subscribe(
      (res: APISkillModel[]) => {
        this.setModelAndGenerateChart(res);
      },
      (error: Error) => {
        this.log.exception(error, 'Error getting all skills');
      }
    );
  }

  setModel(skills: APISkillModel[]): void {
    this.model = SkillChartModel.fromAPIArray(skills);
    this.graph = this.model.toChartArgs();
  }

  setModelAndGenerateChart(skills: APISkillModel[]): void {
    this.setModel(skills);
    this.adjustChartOptions();
    this.generateChart();
  }

  get screenWidth(): number {
    if (isPlatformServer(this.platformId)) {
      return 600;
    }
    return window.innerWidth;
  }

  get chartHeight(): number {
    const screenWidth: number = this.screenWidth;
    let height: number;
    switch (true) {
      case screenWidth < 768:
        height = 0.75 * screenWidth;
        break;
      case screenWidth < 992:
        height = 0.5 * screenWidth;
        break;
      default:
        height = 700;
        break;
    }
    return height;
  }
}
