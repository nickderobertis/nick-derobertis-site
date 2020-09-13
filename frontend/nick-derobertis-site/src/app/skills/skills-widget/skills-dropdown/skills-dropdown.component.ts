import {
  Component,
  Input,
  OnInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { APISkillModel } from 'src/app/global/interfaces/generated/skills';
import { SkillsService } from '../../skills.service';
import { SkillDropdownModel } from './skill-dropdown-model';
import { SkillModel } from './skill-model';

@Component({
  selector: 'nds-skills-dropdown',
  templateUrl: './skills-dropdown.component.html',
  styleUrls: ['./skills-dropdown.component.scss'],
})
export class SkillsDropdownComponent implements OnInit {
  @Input() model: SkillDropdownModel;
  @ViewChildren(SkillsDropdownComponent) dropdowns!: QueryList<
    SkillsDropdownComponent
  >;
  childDropdownModels: SkillDropdownModel[] = [];

  constructor(private skillsService: SkillsService) {}

  ngOnInit(): void {
    if (this.model.loadChildren) {
      this.getChildSkills();
    }
  }

  getChildSkills(): void {
    this.skillsService
      .getChildSkills(this.model.skill.title)
      .subscribe((skills: APISkillModel[]) => {
        this.setChildSkills(skills);
      });
  }

  setChildSkills(skills: APISkillModel[]): void {
    this.model.childSkills = SkillModel.arrayFromAPIArray(skills);
    this.childDropdownModels = SkillDropdownModel.arrFromSkillModelArr(
      this.model.childSkills,
      !this.model.isChild
    );
  }

  loadChildSkillsInChildren(event: MouseEvent): void {
    if (this.model.childrensChildrenHaveBeenLoaded) {
      return;
    }
    if (!this.model.hasChildren) {
      return;
    }
    if (!this.model.isChild) {
      // Parent skills' children are already pre-loaded
      return;
    }
    for (const dropdown of this.dropdowns) {
      dropdown.getChildSkills();
    }
    this.model.childrensChildrenHaveBeenLoaded = true;
  }

  get aClassStr(): string {
    const classes: string[] = ['skill-dropdown-item'];
    if (this.model.isChild) {
      classes.push('dropdown-item');
    }
    if (this.model.hasChildren) {
      classes.push('dropdown-toggle');
    } else {
      classes.push('no-link');
    }

    return classes.join(' ');
  }
}
