import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SoftwareBannerComponent } from './software-banner.component';

describe('SoftwareBannerComponent', () => {
  let component: SoftwareBannerComponent;
  let fixture: ComponentFixture<SoftwareBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SoftwareBannerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SoftwareBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
