import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SoftwarePageComponent } from './software-page.component';

describe('SoftwarePageComponent', () => {
  let component: SoftwarePageComponent;
  let fixture: ComponentFixture<SoftwarePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SoftwarePageComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SoftwarePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
