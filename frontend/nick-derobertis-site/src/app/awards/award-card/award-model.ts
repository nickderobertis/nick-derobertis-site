import { APIAwardModel } from 'src/app/global/interfaces/generated/awards';

export class AwardModel {
  title: string;
  logoSvgText?: string;
  logoFaIconClassStr?: string;
  received?: string;
  extraInfo?: string;
  awardParts?: string[];

  constructor(args: APIAwardModel) {
    this.title = args.title;
    if (args.logo_svg_text) {
      this.logoSvgText = args.logo_svg_text;
    }
    if (args.logo_fa_icon_class_str) {
      this.logoFaIconClassStr = args.logo_fa_icon_class_str;
    }
    if (args.received) {
      this.received = args.received;
    }
    if (args.extra_info) {
      this.extraInfo = args.extra_info;
    }
    if (args.award_parts) {
      this.awardParts = args.award_parts;
    }
  }

  get imageHTML(): string {
    if (this.logoSvgText) {
      return `<div class="award-specific-image-wrapper">${this.logoSvgText}</div>`;
    } else if (this.logoFaIconClassStr) {
      return `<i class="award-specific-fa-wrapper ${this.logoFaIconClassStr}"></i>`;
    } else {
      throw Error('cannot get image HTML when no image properties are set');
    }
  }

  static arrFromArgsArr(args: APIAwardModel[]): AwardModel[] {
    const models: AwardModel[] = [];
    for (const arg of args) {
      const mod = new AwardModel(arg);
      models.push(mod);
    }
    return models;
  }
}
