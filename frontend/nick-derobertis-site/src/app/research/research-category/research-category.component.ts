import { Component, Input, OnInit } from '@angular/core';
import { ResearchCategoryModel } from './research-category-model';

@Component({
  selector: 'nds-research-category',
  templateUrl: './research-category.component.html',
  styleUrls: ['./research-category.component.scss'],
})
export class ResearchCategoryComponent implements OnInit {
  @Input() model: ResearchCategoryModel;

  constructor() {}

  ngOnInit(): void {}
}
