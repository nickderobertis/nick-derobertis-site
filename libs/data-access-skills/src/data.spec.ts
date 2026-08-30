import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The slice is validated where it is imported, so what proves that is an
 * import. Each case loads `./data` fresh — once over the committed skills
 * file, and once over a slice the schema rejects — and the refusal under test
 * is that import failing rather than a caller inspecting a return value.
 *
 * The rejection is read by its message rather than by `instanceof`: the module
 * under test is loaded into a fresh registry, so it closes over its own copy of
 * the validators, and the class it throws is not the one this file would import.
 */
afterEach(() => {
  vi.doUnmock("@site/data-access-core/domains/skills");
  vi.resetModules();
});

describe("the committed skills slice", () => {
  it("exports the committed domain once the schema has accepted it", async () => {
    const { skills } = await import("./data");

    expect(skills.length).toBeGreaterThan(0);
    expect(skills.every((skill) => typeof skill.name === "string")).toBe(true);
  });

  it("refuses at import when the slice does not satisfy the schema", async () => {
    // A skill record carrying an id but neither of the two fields
    // the schema requires beside it, which is what a truncated codegen run
    // leaves behind.
    vi.resetModules();
    vi.doMock("@site/data-access-core/domains/skills", () => ({
      skillsArtifact: [{ id: "python" }],
    }));

    await expect(import("./data")).rejects.toThrow(
      "CV skills domain failed schema validation",
    );
  });
});
