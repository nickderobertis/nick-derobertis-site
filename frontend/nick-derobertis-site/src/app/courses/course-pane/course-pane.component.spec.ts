import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoursePaneComponent } from './course-pane.component';

describe('CoursePaneComponent', () => {
  let component: CoursePaneComponent;
  let fixture: ComponentFixture<CoursePaneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CoursePaneComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CoursePaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
