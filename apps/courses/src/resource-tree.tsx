import type { Resource } from "@site/data-access-core";

/**
 * A course's reading list. Resources nest to any depth in the CV, so this
 * renders itself for a resource's children rather than flattening them: a
 * reader has to be able to see which tutorial sits under which topic.
 */
export function ResourceTree({ resources }: { resources: Resource[] }) {
  return (
    <ul className="course-resource-list">
      {resources.map((resource) => (
        <li
          key={`${resource.name}-${resource.author ?? ""}-${resource.url ?? ""}`}
        >
          {resource.url ? (
            <a href={resource.url}>{resource.name}</a>
          ) : (
            <strong>{resource.name}</strong>
          )}
          {resource.author ? <span> by {resource.author}</span> : null}
          {resource.description ? <p>{resource.description}</p> : null}
          {resource.children?.length ? (
            <ResourceTree resources={resource.children} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
