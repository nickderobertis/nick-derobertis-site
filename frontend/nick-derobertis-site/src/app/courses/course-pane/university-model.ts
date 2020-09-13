import { APIUniversityModel } from 'src/app/global/interfaces/generated/courses';

export class UniversityModel {
  title: string;
  abbreviation: string;
  logoUrl?: string;
  logoSvgText?: string;
  logoFaIconClassStr?: string;
  logoBase64?: string;

  constructor(args: APIUniversityModel) {
    this.title = args.title;
    this.abbreviation = args.abbreviation;

    if (args.logo_url) {
      this.logoUrl = args.logo_url;
    }
    if (args.logo_svg_text) {
      this.logoSvgText = args.logo_svg_text;
    }
    if (args.logo_fa_icon_class_str) {
      this.logoFaIconClassStr = args.logo_fa_icon_class_str;
    }
    if (args.logo_base64) {
      this.logoBase64 = args.logo_base64;
    }
  }

  get imageHTML(): string {
    if (this.logoUrl) {
      return `<img src="${this.logoUrl}" class="course-university-logo">`;
    } else if (this.logoBase64) {
      return `<img src="${this.logoBase64}" class="course-university-logo">`;
    } else {
      throw Error('need to implement imageHTML for other than logoUrl');
    }
  }
}
