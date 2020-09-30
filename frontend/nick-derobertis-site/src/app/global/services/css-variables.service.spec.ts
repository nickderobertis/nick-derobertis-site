import { TestBed } from '@angular/core/testing';

import { CSSVariablesService } from './css-variables.service';

describe('CSSVariablesService', () => {
  let service: CSSVariablesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CSSVariablesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
