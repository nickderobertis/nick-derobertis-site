import { Component, Input, OnInit } from '@angular/core';
import { ResearchResourceModel } from './research-resource-model';

@Component({
  selector: 'nds-research-resource',
  templateUrl: './research-resource.component.html',
  styleUrls: ['./research-resource.component.scss']
})
export class ResearchResourceComponent implements OnInit {
  @Input() model: ResearchResourceModel;

  constructor() { }

  ngOnInit(): void {
  }

}
