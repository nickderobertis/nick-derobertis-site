import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The slice is validated where it is imported, so what proves that is an
 * import. Each case loads `./data` fresh — once over the committed timeline
 * file, and once over a slice the schema rejects — and the refusal under test
 * is that import failing rather than a caller inspecting a return value.
 *
 * The rejection is read by its message rather than by `instanceof`: the module
 * under test is loaded into a fresh registry, so it closes over its own copy of
 * the validators, and the class it throws is not the one this file would import.
 */
afterEach(() => {
  vi.doUnmock("@site/data-access-core/domains/timeline");
  vi.resetModules();
});

describe("the committed timeline slice", () => {
  it("exports the committed domain once the schema has accepted it", async () => {
    const { timeline } = await import("./data");

    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline.every((entry) => typeof entry.organization === "string")).toBe(
      true,
    );
  });

  it("refuses at import when the slice does not satisfy the schema", async () => {
    // An education entry with none of the organization, location,
    // start or degree the schema requires of one.
    vi.resetModules();
    vi.doMock("@site/data-access-core/domains/timeline", () => ({
      timelineArtifact: [{ id: "uf", kind: "education" }],
    }));

    await expect(import("./data")).rejects.toThrow(
      "CV timeline domain failed schema validation",
    );
  });
});
