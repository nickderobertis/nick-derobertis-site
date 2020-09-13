import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AwardCardComponent } from './award-card.component';

describe('AwardCardComponent', () => {
  let component: AwardCardComponent;
  let fixture: ComponentFixture<AwardCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AwardCardComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AwardCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
