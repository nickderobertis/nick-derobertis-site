import { APIResearchCategoryModel } from 'src/app/global/interfaces/generated/research';

export class ResearchCategoryModel {
  title: string;
  logoSvgText: string;
  logoFaIconClassStr: string;

  constructor(args: APIResearchCategoryModel) {
    this.title = args.title;
    if (args.logo_svg_text) {
      this.logoSvgText = args.logo_svg_text;
    }
    if (args.logo_fa_icon_class_str) {
      this.logoFaIconClassStr = args.logo_fa_icon_class_str;
    }
  }

  static arrFromAPIArr(
    args: APIResearchCategoryModel[]
  ): ResearchCategoryModel[] {
    const models: ResearchCategoryModel[] = [];
    for (const arg of args) {
      const mod = new ResearchCategoryModel(arg);
      models.push(mod);
    }
    return models;
  }

  get imageHTML(): string {
    if (this.logoSvgText) {
      return `<div class="research-category-img">${this.logoSvgText}</div>`;
    } else if (this.logoFaIconClassStr) {
      return `<div class="research-category-img"><i class="${this.logoFaIconClassStr}"></i></div>`;
    } else {
      return `<div class="research-category-img"><i class="fas fa-book-open"></i></div>`;
    }
  }
}
