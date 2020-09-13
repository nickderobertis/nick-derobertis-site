import { PageLink } from 'src/app/global/interfaces/page-link';

export interface IHomeCardModel {
  heading: string;
  bodyText: string;
  link: PageLink;
  iconClasses: string[];
}
