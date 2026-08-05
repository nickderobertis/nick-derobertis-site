import type { Research } from "@site/data-access-core";
import { buildResearchProjectModels } from "@site/data-access-research";
import { ProjectSection } from "./project-section";

export function ResearchContent({ research }: { research: Research }) {
  return (
    <article className="research-page">
      <header className="research-banner">
        <p className="eyebrow">Research portfolio</p>
        <h1>Research Works</h1>
        <p>
          Working papers and works in progress across finance, markets, and
          investor behavior.
        </p>
        <a className="banner-link" href="#working-papers">
          View research
        </a>
      </header>
      <ProjectSection
        heading="Working Papers"
        id="working-papers"
        projects={buildResearchProjectModels(research, "working_paper")}
      />
      <ProjectSection
        heading="Works in Progress"
        id="works-in-progress"
        projects={buildResearchProjectModels(research, "work_in_progress")}
      />
    </article>
  );
}
