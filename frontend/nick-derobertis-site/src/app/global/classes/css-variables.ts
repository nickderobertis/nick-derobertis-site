export class CSSVariables {
  static get(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(
      this.fullName(name)
    );
  }

  static set(name: string, value: string): void {
    document.documentElement.style.setProperty(this.fullName(name), value);
  }

  static fullName(name: string): string {
    return `--${name}`;
  }

  static numbersFromString(str: string): number {
    return parseInt(str.match(/(\d+)/)[0], 10);
  }
}
