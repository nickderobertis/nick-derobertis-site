import { cvDataClient, type SoftwareProject } from "@site/data-access-core";
import {
  calculateSoftwareStats,
  softwareProjectLogo,
} from "@site/data-access-software";
import { useEffect, useState } from "react";
import "@site/design-system";

type SoftwareView = "default" | "empty" | "error" | "loading";

function requestedView(): SoftwareView {
  const value = new URLSearchParams(window.location.search).get(
    "software-view",
  );
  return value === "empty" || value === "error" || value === "loading"
    ? value
    : "default";
}

function useSoftwareView(): SoftwareView {
  const [view, setView] = useState<SoftwareView>(() => requestedView());
  useEffect(() => {
    if (view !== "loading") return;
    const timer = window.setTimeout(() => setView("default"), 1_500);
    return () => window.clearTimeout(timer);
  }, [view]);
  return view;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function ProjectCard({ project }: { project: SoftwareProject }) {
  const title = project.display_name ?? project.name;
  const logo = softwareProjectLogo(project);
  return (
    <article className="software-card">
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
            {"</>"}
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
          <a href={project.repository_url}>Repository</a>
        ) : null}
        {project.docs_url ? <a href={project.docs_url}>Documentation</a> : null}
        {project.site_url && project.site_url !== project.repository_url ? (
          <a href={project.site_url}>Project site</a>
        ) : null}
      </div>
    </article>
  );
}

function SoftwareCollection({ projects }: { projects: SoftwareProject[] }) {
  const stats = calculateSoftwareStats(projects);
  return (
    <>
      <dl className="software-stats" aria-label="Software statistics">
        <div>
          <dt>Open-source projects</dt>
          <dd>{formatNumber(stats.projects)}</dd>
        </div>
        <div>
          <dt>Lines of code</dt>
          <dd>{formatNumber(stats.linesOfCode)}</dd>
        </div>
        <div>
          <dt>Commits</dt>
          <dd>{formatNumber(stats.commits)}</dd>
        </div>
      </dl>
      <section className="software-grid" aria-label="Software projects">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </section>
    </>
  );
}

export default function SoftwarePage() {
  const view = useSoftwareView();
  const projects = cvDataClient.domain("software_projects");
  return (
    <section className="software-page">
      <header className="software-banner">
        <p className="eyebrow">Nick DeRobertis</p>
        <h1>Open-Source Software</h1>
        <p>
          I am a strong believer in free and open-source software. Explore my
          projects for finance, research, data, and Python.
        </p>
      </header>
      {view === "loading" ? (
        <div className="software-state" role="status">
          Loading software projects…
        </div>
      ) : view === "error" ? (
        <div className="software-state software-state-error" role="alert">
          <h2>Software projects are unavailable</h2>
          <p>Please try again later.</p>
        </div>
      ) : view === "empty" ? (
        <div className="software-state" role="status">
          <h2>No software projects to show</h2>
          <p>New open-source work will appear here.</p>
        </div>
      ) : (
        <SoftwareCollection projects={projects} />
      )}
    </section>
  );
}
