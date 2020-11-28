export class PersonalDetails {
  email: string = 'derobertisna@ufl.edu';
  firstName: string = 'Nick';
  lastName: string = 'DeRobertis';
  githubUsername: string = 'nickderobertis';
  linkedInUrl: string = 'https://www.linkedin.com/in/nick-derobertis-14062217/';
  phoneNumber: number = 7038284709;
  countryCode: number = 1;
  addressLine1: string = 'Stuzin Hall';
  addressLine2: string = '1454 Union Rd.';
  city: string = 'Gainesville';
  stateCode: string = 'FL';
  zipCode: string = '32611';
  country: string = 'United States';

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

  get addressLines(): string[] {
    let addressLines: string[] = [];
    addressLines.push(this.addressLine1);
    if (this.addressLine2) {
      addressLines.push(this.addressLine2);
    }
    addressLines = addressLines.concat([
      this.city,
      this.stateCode,
      this.zipCode,
    ]);
    if (this.country !== 'United States') {
      addressLines.push(this.country);
    }
    return addressLines;
  }

  get fullAddress(): string {
    let addressStr: string = '';
    let i: number = 0;
    for (const line of this.addressLines) {
      i++;
      if (i == 1) {
        addressStr += line;
      } else if (line === this.zipCode) {
        addressStr += `  ${this.zipCode}`;
      } else {
        addressStr += `, ${line}`;
      }
    }
    return addressStr;
  }
}

export const personalDetails = new PersonalDetails();
