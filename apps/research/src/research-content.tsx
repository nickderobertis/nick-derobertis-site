import type { Research } from "@site/data-access-core";
import {
  buildResearchProjectModels,
  type ResearchProjectModel,
} from "@site/data-access-research";
import { ResearchProjectPane } from "./research-project-pane";

function ProjectSection({
  heading,
  id,
  projects,
}: {
  heading: string;
  id: string;
  projects: ResearchProjectModel[];
}) {
  return (
    <section
      className="research-section"
      aria-labelledby={`${id}-heading`}
      id={id}
    >
      <div className="research-section-heading">
        <p>{projects.length.toString().padStart(2, "0")}</p>
        <h2 id={`${id}-heading`}>{heading}</h2>
      </div>
      <div className="research-projects">
        {projects.map(({ categories, coauthors, project }, index) => (
          <ResearchProjectPane
            categories={categories}
            coauthors={coauthors}
            index={index}
            key={project.id}
            project={project}
          />
        ))}
      </div>
    </section>
  );
}

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
