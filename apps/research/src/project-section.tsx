import type { ResearchProjectModel } from "@site/data-access-research";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { SectionHeading } from "@site/design-system";
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
      <SectionHeading
        className="research-section-heading"
        eyebrow={projects.length.toString().padStart(2, "0")}
        title={heading}
        titleId={`${id}-heading`}
      />
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
