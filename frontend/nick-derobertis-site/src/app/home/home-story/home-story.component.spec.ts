import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeStoryComponent } from './home-story.component';

describe('HomeStoryComponent', () => {
  let component: HomeStoryComponent;
  let fixture: ComponentFixture<HomeStoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HomeStoryComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HomeStoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
