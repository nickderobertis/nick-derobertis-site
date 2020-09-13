export class Copyright {
  beginYear: number;
  endYear: number = new Date().getFullYear();

  constructor(beginYear: number) {
    this.beginYear = beginYear;
  }

  get str(): string {
    if (this.beginYear === this.endYear) {
      return this.beginYear.toString();
    }

    return `${this.beginYear}-${this.endYear}`;
  }
}

export const copyright = new Copyright(2020);
