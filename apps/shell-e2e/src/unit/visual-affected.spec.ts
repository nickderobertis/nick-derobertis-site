import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, test } from "vitest";

// The affected-only economics of the screencomp adoption: `nx affected
// --with-target screenshot` selects which microfrontends changed, and
// scripts/affected-visual-projects.mjs turns that into the dynamic `projects`
// matrix screencomp's visual-docs-reusable.yml consumes — one lane per affected
// app, each pinned to its own committed baseline manifest and gallery, so an
// unaffected app is never captured or classified (never reported as removed).

function affectedScreenshotProjects(file: string): string[] {
  const output = execFileSync(
    "pnpm",
    [
      "exec",
      "nx",
      "show",
      "projects",
      "--affected",
      `--files=${file}`,
      "--with-target=screenshot",
      "--json",
    ],
    { encoding: "utf8" },
  );
  const projects: unknown = JSON.parse(output);
  if (
    !Array.isArray(projects) ||
    !projects.every(
      (project) =>
        typeof project === "string" && /^[a-z][a-z0-9-]*$/.test(project),
    )
  )
    throw new Error("Nx affected output was not a list of project names");
  return projects;
}

interface VisualProject {
  id: string;
  current: string;
  verify: string;
  manifest: string;
  "gallery-title": string;
}

function projectsMatrix(names: string[]): VisualProject[] {
  const output = execFileSync(
    "node",
    ["scripts/affected-visual-projects.mjs"],
    { encoding: "utf8", input: JSON.stringify(names) },
  );
  return JSON.parse(output);
}

// The full matrix the CI `affected` job feeds into `projects`, derived end to end
// from Nx affected selection.
function affectedProjectsMatrix(file: string): VisualProject[] {
  return projectsMatrix(affectedScreenshotProjects(file));
}

describe("visual affected selection", () => {
  test("a remote change recaptures only that remote", () => {
    expect(affectedScreenshotProjects("apps/skills/src/page.tsx")).toEqual([
      "skills",
    ]);
  });

  test("a shared design-system change recaptures exactly its dependent remotes", () => {
    expect(
      affectedScreenshotProjects("libs/design-system/src/theme.css").sort(),
    ).toEqual(
      [
        "awards",
        "bio",
        "courses",
        "home",
        "home-cards",
        "home-carousel",
        "home-contact",
        "home-story",
        "research",
        "skills",
        "software",
        "timeline",
      ].sort(),
    );
  });

  test("a single-remote change yields a one-lane projects matrix", () => {
    expect(affectedProjectsMatrix("apps/skills/src/page.tsx")).toEqual([
      {
        id: "skills",
        current: "shots/current/skills",
        verify: "shots/verify/skills",
        manifest: "apps/skills/visual/baseline/x86_64.json",
        "gallery-title": "skills",
      },
    ]);
  });

  test("a shared-lib change yields a projects matrix for exactly its dependents", () => {
    const matrix = affectedProjectsMatrix("libs/design-system/src/theme.css");
    expect(matrix.map((project) => project.id)).toEqual(
      [
        "awards",
        "bio",
        "courses",
        "home",
        "home-cards",
        "home-carousel",
        "home-contact",
        "home-story",
        "research",
        "skills",
        "software",
        "timeline",
      ].sort(),
    );
    // Each lane points classification at that app's own committed baseline and
    // its own capture/verify roots beneath shots/.
    for (const project of matrix) {
      expect(project.current).toBe(`shots/current/${project.id}`);
      expect(project.verify).toBe(`shots/verify/${project.id}`);
      expect(project.manifest).toBe(
        `apps/${project.id}/visual/baseline/x86_64.json`,
      );
      expect(project["gallery-title"]).toBe(project.id);
    }
  });

  test("no affected visual project yields an empty matrix (workflow skips capture)", () => {
    expect(projectsMatrix([])).toEqual([]);
  });

  test.each([
    ["a non-array payload", '"skills"'],
    ["an invalid project name", '["Bad_Name"]'],
    ["an unknown workspace app", '["not-a-real-app"]'],
  ])("the projects matrix rejects %s", (_, payload) => {
    const result = spawnSync("node", ["scripts/affected-visual-projects.mjs"], {
      encoding: "utf8",
      input: payload,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toBe("");
  });

  test("capture output cannot escape its owning project", () => {
    const capture = spawnSync(
      "node",
      ["scripts/capture-visual.mjs", "bio", "/tmp/escaped-visual"],
      { encoding: "utf8" },
    );
    expect(capture.status).not.toBe(0);
    expect(capture.stderr).toContain("Output root must be inside");
  });

  test("the PR #12 reference set is mapped to per-remote baselines", () => {
    expect(() =>
      execFileSync("node", ["scripts/verify-reference-migration.mjs"], {
        encoding: "utf8",
      }),
    ).not.toThrow();
  });

  test("visual tooling pins stay synchronized", () => {
    expect(() =>
      execFileSync("node", ["scripts/verify-visual-contract.mjs"], {
        encoding: "utf8",
      }),
    ).not.toThrow();
  });

  test("bootstrap provisions pinned workflow and shell linters without ambient tools", () => {
    const verify = spawnSync("scripts/setup-ci-tools.sh", ["--verify"], {
      encoding: "utf8",
      env: { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin` },
    });
    expect(verify.status, verify.stderr).toBe(0);
    expect(verify.stdout).toBe("actionlint 1.7.12, shellcheck 0.11.0\n");
  });
});
