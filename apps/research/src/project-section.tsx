import type { ResearchProjectModel } from "@site/data-access-research";
import { ResearchProjectPane } from "./research-project-pane";

export function ProjectSection({
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
