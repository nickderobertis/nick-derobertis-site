import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkillsPaneComponent } from './skills-pane.component';

describe('SkillsPaneComponent', () => {
  let component: SkillsPaneComponent;
  let fixture: ComponentFixture<SkillsPaneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SkillsPaneComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SkillsPaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
