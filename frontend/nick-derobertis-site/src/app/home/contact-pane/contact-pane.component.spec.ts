import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactPaneComponent } from './contact-pane.component';

describe('ContactPaneComponent', () => {
  let component: ContactPaneComponent;
  let fixture: ComponentFixture<ContactPaneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ContactPaneComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ContactPaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
