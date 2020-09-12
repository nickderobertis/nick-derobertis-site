import { PageLink } from 'src/app/global/interfaces/page-link';
import { IHomeCarouselItemModel } from './i-home-carousel-item-model';

export class HomeCarouselItemModel implements IHomeCarouselItemModel {
  imageHref: string;
  captionClasses: string[];
  headerText: string;
  bodyText: string;
  links: PageLink[];

  constructor(args: IHomeCarouselItemModel) {
    if (!args.captionClasses) {
      this.captionClasses = ['carousel-caption'];
    } else {
      this.captionClasses = args.captionClasses;
    }

    this.imageHref = args.imageHref;
    this.headerText = args.headerText;
    this.bodyText = args.bodyText;
    this.links = args.links;
  }

  get captionDivClassesStr(): string {
    return this.captionClasses.join(' ');
  }
}
