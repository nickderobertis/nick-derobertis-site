import { PageLink } from 'src/app/global/interfaces/page-link';

export interface IHomeCarouselItemModel {
  imageHref: string;
  captionClasses?: string[];
  headerText: string;
  bodyText: string;
  links: PageLink[];
}
