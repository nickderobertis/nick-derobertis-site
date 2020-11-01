import { andJoin } from 'src/app/global/functions/text';
import { APIResearchModel } from 'src/app/global/interfaces/generated/research';
import { ResearchCategoryModel } from '../research-category/research-category-model';
import { ResearchResourceModel } from '../research-resource/research-resource-model';
import { CoAuthorModel } from './co-author-model';

export class ResearchModel {
  title: string;
  coAuthors: CoAuthorModel[] = [];
  description: string;
  categories: ResearchCategoryModel[] = [];
  resources: ResearchResourceModel[] = [];
  href?: string;

  constructor(args: APIResearchModel) {
    this.title = args.title;
    this.coAuthors = CoAuthorModel.arrFromAPIArr(args.co_authors);
    this.description = args.description;
    this.categories = ResearchCategoryModel.arrFromAPIArr(args.categories);
    this.resources = ResearchResourceModel.arrFromAPIArr(args.resources);

    if (args.href) {
      this.href = args.href;
    }
  }

  static arrFromAPIArr(args: APIResearchModel[]): ResearchModel[] {
    const models: ResearchModel[] = [];
    for (const arg of args) {
      const mod = new ResearchModel(arg);
      models.push(mod);
    }
    return models;
  }

  get coAuthorsStr(): string {
    const names: string[] = this.coAuthors.map(
      (coAuthor: CoAuthorModel) => coAuthor.name
    );
    return andJoin(names);
  }
}
