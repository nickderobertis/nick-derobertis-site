import { Component, Input, OnInit } from '@angular/core';
import { SkillDropdownModel } from './skill-dropdown-model';

@Component({
  selector: 'nds-skills-dropdown',
  templateUrl: './skills-dropdown.component.html',
  styleUrls: ['./skills-dropdown.component.scss'],
})
export class SkillsDropdownComponent implements OnInit {
  @Input() model: SkillDropdownModel;

  constructor() {}

  ngOnInit(): void {}
}
