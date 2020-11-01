import { APIResourceModel } from 'src/app/global/interfaces/generated/research';

export class ResearchResourceModel implements APIResourceModel {
  name: string;
  url: string;
  author?: string;
  description?: string;

  constructor(args: APIResourceModel) {
    this.name = args.name;
    this.url = args.url;
    if (args.author) {
      this.author = args.author;
    }
    if (args.description) {
      this.description = args.description;
    }
  }

  static arrFromAPIArr(
    args: APIResourceModel[]
  ): ResearchResourceModel[] {
    const models: ResearchResourceModel[] = [];
    for (const arg of args) {
      const mod = new ResearchResourceModel(arg);
      models.push(mod);
    }
    return models;
  }

  get fullDescription(): string {
    let desc: string = this.name;
    if (this.author) {
      desc += ` (${this.author})`;
    }
    if (this.description) {
      desc += ` | ${this.description}`;
    }
    return desc;
  }

}
