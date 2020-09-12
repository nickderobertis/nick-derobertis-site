import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeCarouselItemComponent } from './home-carousel-item.component';

describe('HomeCarouselItemComponent', () => {
  let component: HomeCarouselItemComponent;
  let fixture: ComponentFixture<HomeCarouselItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HomeCarouselItemComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HomeCarouselItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
