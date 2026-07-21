import { cvDataClient } from "@site/data-access-core";
import { describe, expect, it } from "vitest";
import { buildResearchProjectModels } from "./index";

describe("research shaping", () => {
  it("resolves project relationships and filters status", () => {
    const research = cvDataClient.domain("research");
    const models = buildResearchProjectModels(research, "working_paper");
    expect(
      models.every(({ project }) => project.status === "working_paper"),
    ).toBe(true);
    expect(
      models.every(
        ({ categories, coauthors }) =>
          categories.every(Boolean) && coauthors.every(Boolean),
      ),
    ).toBe(true);
    expect(buildResearchProjectModels({}, "working_paper")).toEqual([]);

    const project = research.projects?.[0];
    const category = research.categories?.[0];
    const coauthor = research.coauthors?.[0];
    expect(project).toBeDefined();
    expect(category).toBeDefined();
    expect(coauthor).toBeDefined();
    if (!project || !category || !coauthor) return;
    const resolved = buildResearchProjectModels(
      {
        categories: [category],
        coauthors: [coauthor],
        projects: [
          {
            ...project,
            category_ids: [category.id],
            coauthor_ids: [coauthor.id],
          },
        ],
      },
      project.status,
    );
    expect(resolved[0]).toMatchObject({
      categories: [category],
      coauthors: [coauthor],
    });
    const unresolved = buildResearchProjectModels(
      {
        projects: [
          {
            ...project,
            category_ids: ["missing"],
            coauthor_ids: ["missing"],
          },
        ],
      },
      project.status,
    );
    expect(unresolved[0]).toMatchObject({ categories: [], coauthors: [] });
    const withoutRelationships = buildResearchProjectModels(
      {
        projects: [
          {
            ...project,
            category_ids: undefined,
            coauthor_ids: undefined,
          },
        ],
      },
      project.status,
    );
    expect(withoutRelationships[0]).toMatchObject({
      categories: [],
      coauthors: [],
    });
  });
});
