import type {
  Person,
  Research,
  ResearchCategory,
  ResearchProject,
} from "@site/data-access-core";

export interface ResearchProjectModel {
  categories: ResearchCategory[];
  coauthors: Person[];
  project: ResearchProject;
}

function byId<Item extends { id: string }>(items: Item[] | undefined) {
  return new Map(items?.map((item) => [item.id, item]));
}

export function buildResearchProjectModels(
  research: Research,
  status: ResearchProject["status"],
): ResearchProjectModel[] {
  const categories = byId(research.categories);
  const coauthors = byId(research.coauthors);
  return (research.projects ?? [])
    .filter((project) => project.status === status)
    .map((project) => ({
      categories:
        project.category_ids?.flatMap((id) => {
          const category = categories.get(id);
          return category ? [category] : [];
        }) ?? [],
      coauthors:
        project.coauthor_ids?.flatMap((id) => {
          const coauthor = coauthors.get(id);
          return coauthor ? [coauthor] : [];
        }) ?? [],
      project,
    }));
}
