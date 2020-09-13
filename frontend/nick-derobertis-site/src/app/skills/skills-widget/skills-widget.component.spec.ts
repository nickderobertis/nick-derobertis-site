import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkillsWidgetComponent } from './skills-widget.component';

describe('SkillsWidgetComponent', () => {
  let component: SkillsWidgetComponent;
  let fixture: ComponentFixture<SkillsWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SkillsWidgetComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SkillsWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
