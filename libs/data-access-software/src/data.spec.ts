import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The slice is validated where it is imported, so what proves that is an
 * import. Each case loads `./data` fresh — once over the committed software_projects
 * file, and once over a slice the schema rejects — and the refusal under test
 * is that import failing rather than a caller inspecting a return value.
 *
 * The rejection is read by its message rather than by `instanceof`: the module
 * under test is loaded into a fresh registry, so it closes over its own copy of
 * the validators, and the class it throws is not the one this file would import.
 */
afterEach(() => {
  vi.doUnmock("@site/data-access-core/domains/software_projects");
  vi.resetModules();
});

describe("the committed software_projects slice", () => {
  it("exports the committed domain once the schema has accepted it", async () => {
    const { softwareProjects } = await import("./data");

    expect(softwareProjects.length).toBeGreaterThan(0);
    expect(
      softwareProjects.every((project) => typeof project.name === "string"),
    ).toBe(true);
  });

  it("refuses at import when the slice does not satisfy the schema", async () => {
    // A project record carrying an id but not the name the schema
    // requires beside it.
    vi.resetModules();
    vi.doMock("@site/data-access-core/domains/software_projects", () => ({
      softwareProjectsArtifact: [{ id: "pysentiment" }],
    }));

    await expect(import("./data")).rejects.toThrow(
      "CV software_projects domain failed schema validation",
    );
  });
});
