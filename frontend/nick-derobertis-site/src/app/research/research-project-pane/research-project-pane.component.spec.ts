import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResearchProjectPaneComponent } from './research-project-pane.component';

describe('ResearchProjectPaneComponent', () => {
  let component: ResearchProjectPaneComponent;
  let fixture: ComponentFixture<ResearchProjectPaneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ResearchProjectPaneComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ResearchProjectPaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
