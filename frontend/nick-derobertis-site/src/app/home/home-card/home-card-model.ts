import { PageLink } from 'src/app/global/interfaces/page-link';
import { IHomeCardModel } from './i-home-card-model';

export class HomeCardModel implements IHomeCardModel {
  heading: string;
  bodyText: string;
  link: PageLink;
  iconClasses: string[];

  constructor(args: IHomeCardModel) {
    this.heading = args.heading;
    this.bodyText = args.bodyText;
    this.link = args.link;
    this.iconClasses = args.iconClasses;
  }

  get iconClassStr(): string {
    return this.iconClasses.join(' ');
  }
}
