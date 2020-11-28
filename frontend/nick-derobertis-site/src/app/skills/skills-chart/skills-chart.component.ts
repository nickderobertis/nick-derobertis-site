import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  Inject,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { SunburstArgs } from './sunburst-args';

declare const Plotly: any;

@Component({
  selector: 'nds-skills-chart',
  templateUrl: './skills-chart.component.html',
  styleUrls: ['./skills-chart.component.scss'],
})
export class SkillsChartComponent implements OnInit {
  @ViewChild('skillChart', { static: true }) skillChart: ElementRef;
  graph: SunburstArgs = {
    data: [
      {
        type: 'sunburst',
        labels: [
          'Eve',
          'Cain',
          'Seth',
          'Enos',
          'Noam',
          'Abel',
          'Awan',
          'Enoch',
          'Azura',
        ],
        parents: [
          '',
          'Eve',
          'Eve',
          'Seth',
          'Seth',
          'Eve',
          'Eve',
          'Awan',
          'Eve',
        ],
        values: [10, 14, 12, 10, 2, 6, 6, 4, 4],
      },
    ],
    layout: {},
    options: {
      responsive: true,
    },
  };

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.generateChart();
    }
  }

  generateChart(): void {
    this.skillChart = Plotly.newPlot(
      this.skillChart.nativeElement,
      this.graph.data,
      this.graph.layout,
      this.graph.options
    );
  }
}
