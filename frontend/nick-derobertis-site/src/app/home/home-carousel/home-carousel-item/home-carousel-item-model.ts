import { PageLink } from 'src/app/global/interfaces/page-link';
import { IHomeCarouselItemModel } from './i-home-carousel-item-model';

export class HomeCarouselItemModel implements IHomeCarouselItemModel {
  imageHref: string;
  captionClasses: string[];
  headerText: string;
  bodyText: string;
  links: PageLink[] = [];
  fragmentLinks: PageLink[] = [];

  constructor(args: IHomeCarouselItemModel) {
    if (!args.captionClasses) {
      this.captionClasses = ['carousel-caption'];
    } else {
      this.captionClasses = args.captionClasses;
    }

    if (args.links) {
      this.links = args.links;
    }

    if (args.fragmentLinks) {
      this.fragmentLinks = args.fragmentLinks;
    }

    this.imageHref = args.imageHref;
    this.headerText = args.headerText;
    this.bodyText = args.bodyText;
  }

  get captionDivClassesStr(): string {
    return this.captionClasses.join(' ');
  }
}
