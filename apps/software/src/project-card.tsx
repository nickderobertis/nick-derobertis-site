import type { SoftwareProject } from "@site/data-access-core";
import { softwareProjectLogo } from "@site/data-access-software";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { Card, SpikeIcon } from "@site/design-system";
import { formatNumber } from "./format-number";

export function ProjectCard({ project }: { project: SoftwareProject }) {
  const title = project.display_name ?? project.name;
  const logo = softwareProjectLogo(project);
  return (
    <Card className="software-card">
      <div className="software-card-heading">
        {logo ? (
          <img
            className="software-logo"
            src={logo}
            alt={`${title} logo`}
            loading="lazy"
          />
        ) : (
          <span className="software-logo-fallback" aria-hidden="true">
            <SpikeIcon name="microchip" size={32} />
          </span>
        )}
        <div>
          <p className="software-package">
            {project.package_name ?? project.name}
          </p>
          <h2>{title}</h2>
        </div>
      </div>
      <p className="software-description">
        {project.description ?? "A maintained open-source software project."}
      </p>
      <dl className="software-card-stats">
        <div>
          <dt>Lines of code</dt>
          <dd>{formatNumber(project.loc ?? 0)}</dd>
        </div>
        <div>
          <dt>Commits</dt>
          <dd>{formatNumber(project.commits ?? 0)}</dd>
        </div>
      </dl>
      <div className="software-links">
        {project.repository_url ? (
          <a href={project.repository_url}>
            <SpikeIcon name="github" size={16} /> GitHub
          </a>
        ) : null}
        {project.docs_url ? <a href={project.docs_url}>
            <SpikeIcon name="book" size={16} /> Docs
          </a> : null}
        {project.site_url && project.site_url !== project.repository_url ? (
          <a href={project.site_url}>Project site</a>
        ) : null}
      </div>
    </Card>
  );
}
