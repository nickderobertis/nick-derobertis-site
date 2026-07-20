import { describe, expect, it } from "vitest";
import { cvDataClient } from "./client";
import { buildSkillTree } from "./skills";

describe("skill tree boundary", () => {
  it("preserves a valid empty domain", () => {
    expect(buildSkillTree([])).toEqual({
      children: [],
      skillCount: 0,
      title: "Skills",
    });
  });

  it("rejects a domain without the required navigation categories", () => {
    expect(() =>
      buildSkillTree([
        {
          children: [],
          id: "programming",
          level: 5,
          listed: true,
          name: "Programming",
        },
      ]),
    ).toThrow("Skills data is missing category frameworks");
  });

  it("turns the validated CV domain into the complete recursive model", () => {
    const tree = buildSkillTree(cvDataClient.domain("skills"));

    expect(tree.title).toBe("Skills");
    expect(tree.skillCount).toBe(198);
    expect(tree.children.map((category) => category.title)).toEqual([
      "Frameworks",
      "Programming",
      "Dev-Ops",
      "Data Science",
      "Other",
      "presentation",
      "IoT",
    ]);
    const programming = tree.children.find(
      (category) => category.id === "programming",
    );
    expect(programming).toMatchObject({
      experience: "High Aptitude",
      firstUsed: "2012-09-01",
      hours: 21724.285714285714,
      level: 5,
      title: "Programming",
    });
    expect(
      tree.children.reduce(
        (count, category) => count + category.children.length,
        0,
      ),
    ).toBe(192);
  });
});
