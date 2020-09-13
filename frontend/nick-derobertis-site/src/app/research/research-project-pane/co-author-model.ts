import { APICoAuthorModel } from 'src/app/global/interfaces/generated/research';

export class CoAuthorModel implements APICoAuthorModel {
  name: string;

  constructor(args: APICoAuthorModel) {
    this.name = args.name;
  }

  static arrFromAPIArr(args: APICoAuthorModel[]): CoAuthorModel[] {
    const models: CoAuthorModel[] = [];
    for (const arg of args) {
      const mod = new CoAuthorModel(arg);
      models.push(mod);
    }
    return models;
  }
}
