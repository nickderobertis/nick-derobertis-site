import { EventTypes } from 'src/app/global/classes/event-types';
import { numberWithCommasAndKM } from 'src/app/global/functions/text';
import { APISoftwareModel } from 'src/app/global/interfaces/generated/software';
import { IEvent } from 'src/app/global/services/events/i-event';

export class SoftwareProjectModel {
  title: string;
  description: string;
  displayTitle: string;
  created?: string;
  updated?: string;
  version?: string;
  loc?: number;
  commits?: number;
  url?: string;
  githubUrl?: string;
  docsUrl?: string;
  logoUrl?: string;
  packageDirectory?: string;
  logoSvgText?: string;
  logoFaIconClassStr: string = 'fas fa-microchip';
  logoBase64?: string;

  constructor(args: APISoftwareModel) {
    this.title = args.title;
    this.description = args.description;
    this.displayTitle = args.display_title;

    if (args.created) {
      this.created = args.created;
    }
    if (args.updated) {
      this.updated = args.updated;
    }
    if (args.version) {
      this.version = args.version;
    }
    if (args.loc) {
      this.loc = args.loc;
    }
    if (args.commits) {
      this.commits = args.commits;
    }
    if (args.url) {
      this.url = args.url;
    }
    if (args.github_url) {
      this.githubUrl = args.github_url;
    }
    if (args.docs_url) {
      this.docsUrl = args.docs_url;
    }
    if (args.logo_url) {
      this.logoUrl = args.logo_url;
    }
    if (args.package_directory) {
      this.packageDirectory = args.package_directory;
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

  static arrFromAPIArr(args: APISoftwareModel[]): SoftwareProjectModel[] {
    const models: SoftwareProjectModel[] = [];
    for (const arg of args) {
      const mod = new SoftwareProjectModel(arg);
      models.push(mod);
    }
    return models;
  }

  get logoHTML(): string {
    if (this.logoUrl) {
      return `<img src="${this.logoUrl}" class="card-img-top software-card-img">`;
    } else if (this.logoBase64) {
      return `<img src="${this.logoBase64}" class="card-img-top software-card-img">`;
    } else {
      return `<i
        class="software-card-img software-card-img-placeholder ${this.logoFaIconClassStr} text-secondary text-center"
        aria-hidden="true"></i>`;
    }
  }

  get accentText(): string {
    const accentParts: string[] = [];
    const formattedVersion = this.formattedVersion;
    if (formattedVersion) {
      accentParts.push(formattedVersion);
    }
    if (this.commits) {
      const commitsStr: string = numberWithCommasAndKM(this.commits);
      accentParts.push(`${commitsStr} Commits`);
    }
    if (this.loc) {
      const locStr: string = numberWithCommasAndKM(this.loc);
      accentParts.push(`${locStr} LOC`);
    }
    return accentParts.join(', ');
  }

  get viewGithubEvent(): IEvent {
    const siteName: string = `Github - ${this.title}`;
    return EventTypes.viewExternalSite(siteName);
  }

  get viewDocsEvent(): IEvent {
    const siteName: string = `Docs - ${this.title}`;
    return EventTypes.viewExternalSite(siteName);
  }

  get formattedVersion(): string | undefined {
    if (!this.version) {
      return undefined;
    }

    if (
      this.version.startsWith('untagged') ||
      this.version === '0.0.0-development'
    ) {
      return undefined;
    }

    if (this.version.startsWith('v')) {
      return this.version;
    }

    return `v${this.version}`;
  }
}
