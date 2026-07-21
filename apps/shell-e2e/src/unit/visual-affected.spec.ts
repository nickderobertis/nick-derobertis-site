import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

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

describe("visual affected selection", () => {
  test("changed captures still produce a gallery and PR comment before the gate fails", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".visual-workflow-"));
    try {
      const current = path.join(root, "current", "x86_64");
      const gallery = path.join(root, "gallery");
      const baseline = path.join(root, "baseline.json");
      const comment = path.join(root, "comment.md");
      mkdirSync(current, { recursive: true });
      copyFileSync(
        "reference/screenshots/routes/home/desktop.png",
        path.join(current, "desktop.png"),
      );
      const toggles = {
        render: "standalone",
        state: "happy",
        viewport: "desktop",
      };
      writeFileSync(
        path.join(current, "captures.json"),
        JSON.stringify({
          schema: 1,
          shots: [
            {
              name: "fixture",
              toggles,
              hash: "b".repeat(64),
              image: "desktop.png",
            },
          ],
        }),
      );
      writeFileSync(
        baseline,
        JSON.stringify({
          schema: 1,
          shots: [{ name: "fixture", toggles, hash: "a".repeat(64) }],
        }),
      );
      const publish = spawnSync(
        "scripts/publish-visual-project.sh",
        [
          baseline,
          path.join(root, "current"),
          gallery,
          comment,
          "https://example.test/pr-1/fixture",
        ],
        { encoding: "utf8" },
      );
      expect(publish.status).toBe(3);
      expect(readFileSync(path.join(gallery, "index.html"), "utf8")).toContain(
        "fixture",
      );
      expect(readFileSync(comment, "utf8")).toContain("| 0 | 1 | 0 | 0 |");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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

  test("capture output cannot escape its owning project", () => {
    const capture = spawnSync(
      "node",
      ["scripts/capture-visual.mjs", "bio", "/tmp/escaped-visual"],
      { encoding: "utf8" },
    );
    expect(capture.status).not.toBe(0);
    expect(capture.stderr).toContain("Output root must be inside");
  });

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
});
