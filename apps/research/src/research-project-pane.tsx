import type {
  Person,
  ResearchCategory,
  ResearchProject,
} from "@site/data-access-core";

function CategoryIcon({ id }: { id: string }) {
  const variant = id.length % 4;
  return (
    <svg className="category-icon" viewBox="0 0 32 32" aria-hidden="true">
      {variant === 0 && (
        <>
          <circle cx="16" cy="16" r="10" />
          <path d="m10 18 4-4 3 3 5-6" />
        </>
      )}
      {variant === 1 && (
        <>
          <path d="M6 24h20M9 21V11m7 10V6m7 15v-7" />
          <circle cx="9" cy="8" r="2" />
        </>
      )}
      {variant === 2 && (
        <>
          <path d="m16 4 11 20H5L16 4Z" />
          <path d="M16 11v7m0 3v1" />
        </>
      )}
      {variant === 3 && (
        <>
          <circle cx="16" cy="16" r="11" />
          <path d="M11 12h7a4 4 0 0 1 0 8h-7m5-12v16" />
        </>
      )}
    </svg>
  );
}

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
          <li key={id}>
            <CategoryIcon id={id} />
            <span>{name}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
