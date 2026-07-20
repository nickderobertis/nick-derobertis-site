import type {
  Person,
  ResearchCategory,
  ResearchProject,
} from "@site/data-access";

export function ResearchProjectPane({
  categories = [],
  coauthors = [],
  index,
  project,
}: {
  categories: ResearchCategory[] | undefined;
  coauthors: Person[] | undefined;
  index: number;
  project: ResearchProject;
}) {
  const titleId = `project-${project.id}`;
  return (
    <article
      className="research-project"
      data-tone={index % 2 === 0 ? "light" : "dark"}
      aria-labelledby={titleId}
    >
      <div className="project-copy">
        <p className="project-kind">
          {project.status === "working_paper"
            ? "Working paper"
            : "Work in progress"}
        </p>
        <h3 id={titleId}>{project.title}</h3>
        {coauthors.length > 0 && (
          <p className="coauthors">
            With {coauthors.map(({ name }) => name).join(", ")}
          </p>
        )}
        {project.description && <p>{project.description.trim()}</p>}
        {project.resources && project.resources.length > 0 && (
          <div className="project-resources">
            <h4>Resources</h4>
            <ul>
              {project.resources.map((resource) => (
                <li key={`${project.id}-${resource.name}`}>
                  {resource.url ? (
                    <a href={resource.url}>{resource.name}</a>
                  ) : (
                    resource.name
                  )}
                  {resource.description && <span>{resource.description}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <ul className="project-categories" aria-label="Research categories">
        {categories.map(({ id, name }) => (
          <li key={id}>{name}</li>
        ))}
      </ul>
    </article>
  );
}
