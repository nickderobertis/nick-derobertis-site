export class PersonalDetails {
  email: string = 'derobertisna@ufl.edu';
  firstName: string = 'Nick';
  lastName: string = 'DeRobertis';
  githubUsername: string = 'nickderobertis';
  linkedInUrl: string = 'https://www.linkedin.com/in/nick-derobertis-14062217/';
  phoneNumber: number = 7038284709;
  countryCode: number = 1;

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get githubUrl(): string {
    return `https://github.com/${this.githubUsername}`;
  }

  get phoneNumberString(): string {
    return this.phoneNumber.toString();
  }

  get areaCode(): number {
    return parseInt(this.phoneNumberString.substr(0, 3), 10);
  }

  get beginPhone(): number {
    return parseInt(this.phoneNumberString.substr(3, 3), 10);
  }

  get endPhone(): number {
    return parseInt(this.phoneNumberString.substr(6, 4), 10);
  }

  get phoneNumberDisplay(): string {
    return `(${this.areaCode}) ${this.beginPhone}-${this.endPhone}`;
  }

  get phoneNumberTelLink(): string {
    return `tel:${this.countryCode}-${this.areaCode}-${this.beginPhone}-${this.endPhone}`;
  }
}

export const personalDetails = new PersonalDetails();
