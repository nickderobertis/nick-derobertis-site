import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResearchCategoryComponent } from './research-category.component';

describe('ResearchCategoryComponent', () => {
  let component: ResearchCategoryComponent;
  let fixture: ComponentFixture<ResearchCategoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ResearchCategoryComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ResearchCategoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
