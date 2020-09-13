import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResearchBannerComponent } from './research-banner.component';

describe('ResearchBannerComponent', () => {
  let component: ResearchBannerComponent;
  let fixture: ComponentFixture<ResearchBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ResearchBannerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ResearchBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
