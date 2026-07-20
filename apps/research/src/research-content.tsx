import type {
  Person,
  Research,
  ResearchCategory,
  ResearchProject,
} from "@site/data-access";
import { ResearchProjectPane } from "./research-project-pane";

function byId<Item extends { id: string }>(items: Item[] | undefined) {
  return new Map(items?.map((item) => [item.id, item]));
}

function ProjectSection({
  categories,
  coauthors,
  heading,
  id,
  projects,
}: {
  categories: Map<string, ResearchCategory>;
  coauthors: Map<string, Person>;
  heading: string;
  id: string;
  projects: ResearchProject[];
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
        {projects.map((project, index) => (
          <ResearchProjectPane
            categories={project.category_ids?.flatMap((categoryId) => {
              const category = categories.get(categoryId);
              return category ? [category] : [];
            })}
            coauthors={project.coauthor_ids?.flatMap((coauthorId) => {
              const coauthor = coauthors.get(coauthorId);
              return coauthor ? [coauthor] : [];
            })}
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
  const projects = research.projects ?? [];
  const categories = byId(research.categories);
  const coauthors = byId(research.coauthors);
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
        categories={categories}
        coauthors={coauthors}
        heading="Working Papers"
        id="working-papers"
        projects={projects.filter(({ status }) => status === "working_paper")}
      />
      <ProjectSection
        categories={categories}
        coauthors={coauthors}
        heading="Works in Progress"
        id="works-in-progress"
        projects={projects.filter(
          ({ status }) => status === "work_in_progress",
        )}
      />
    </article>
  );
}
