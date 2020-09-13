import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AwardsPaneComponent } from './awards-pane.component';

describe('AwardsPaneComponent', () => {
  let component: AwardsPaneComponent;
  let fixture: ComponentFixture<AwardsPaneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AwardsPaneComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AwardsPaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
