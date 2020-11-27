export class PersonalDetails {
  email: string = 'derobertisna@ufl.edu';
  firstName: string = 'Nick';
  lastName: string = 'DeRobertis';
  githubUsername: string = 'nickderobertis';
  linkedInUrl: string = 'https://www.linkedin.com/in/nick-derobertis-14062217/';

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get githubUrl(): string {
    return `https://github.com/${this.githubUsername}`;
  }
}

export const personalDetails = new PersonalDetails();
