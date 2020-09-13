export class PersonalDetails {
  email: string = 'derobertisna@ufl.edu';
  firstName: string = 'Nick';
  lastName: string = 'DeRobertis';

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}

export const personalDetails = new PersonalDetails();
