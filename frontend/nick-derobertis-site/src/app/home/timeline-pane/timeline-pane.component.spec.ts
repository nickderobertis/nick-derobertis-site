import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimelinePaneComponent } from './timeline-pane.component';

describe('TimelinePaneComponent', () => {
  let component: TimelinePaneComponent;
  let fixture: ComponentFixture<TimelinePaneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TimelinePaneComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TimelinePaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
