import { cvDataClient } from "@site/data-access-core";
import { describe, expect, it } from "vitest";
import { calculateSoftwareStats, softwareProjectLogo } from "./index";

describe("software shaping", () => {
  it("calculates portfolio totals and chooses logos", () => {
    const projects = cvDataClient.domain("software_projects");
    const stats = calculateSoftwareStats(projects);
    expect(stats.projects).toBe(projects.length);
    expect(stats.linesOfCode).toBeGreaterThanOrEqual(0);
    expect(stats.commits).toBeGreaterThanOrEqual(0);
    const project = projects[0];
    expect(project).toBeDefined();
    if (!project) return;
    expect(softwareProjectLogo({ ...project, logo_base64: "inline" })).toBe(
      "inline",
    );
    expect(
      softwareProjectLogo({
        ...project,
        logo_base64: undefined,
        logo_url: "remote",
      }),
    ).toBe("remote");
    expect(
      softwareProjectLogo({
        ...project,
        logo_base64: undefined,
        logo_url: undefined,
      }),
    ).toBeUndefined();
    expect(
      calculateSoftwareStats([
        { ...project, commits: undefined, loc: undefined },
      ]),
    ).toMatchObject({ commits: 0, linesOfCode: 0, projects: 1 });
  });
});
