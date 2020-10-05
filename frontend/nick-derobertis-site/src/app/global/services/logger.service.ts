import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  constructor() {}

  debug(msg: string): void {
    console.debug(msg);
  }

  info(msg: string): void {
    console.info(msg);
  }

  warn(msg: string): void {
    console.warn(msg);
  }

  error(msg: string): void {
    console.error(msg);
  }

  critical(msg: string): void {
    console.error(msg);
  }

  exception(error: Error, message?: string): void {
    if (message) {
      console.error(message, error);
    } else {
      console.error(error);
    }
  }
}
