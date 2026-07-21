import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

function affectedScreenshots(file: string): string[] {
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
  return JSON.parse(output) as string[];
}

describe("visual affected selection", () => {
  test("changed captures still produce a gallery and PR comment before the gate fails", () => {
    const root = mkdtempSync(path.join(tmpdir(), "visual-workflow-"));
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
      const classify = spawnSync(
        "screencomp",
        [
          "classify",
          "--baseline-manifest",
          baseline,
          "--current",
          path.join(root, "current"),
          "--arch",
          "x86_64",
          "--exit-code",
        ],
        { encoding: "utf8" },
      );
      expect(classify.status).toBe(3);
      execFileSync("screencomp", [
        "gallery",
        "--input",
        path.join(root, "current"),
        "--arch",
        "x86_64",
        "--output",
        gallery,
      ]);
      execFileSync("screencomp", [
        "comment",
        "--baseline-manifest",
        baseline,
        "--current",
        path.join(root, "current"),
        "--arch",
        "x86_64",
        "--gallery-url",
        "https://example.test/pr-1/fixture",
        "--output",
        comment,
      ]);
      expect(readFileSync(path.join(gallery, "index.html"), "utf8")).toContain(
        "fixture",
      );
      expect(readFileSync(comment, "utf8")).toContain("| 0 | 1 | 0 | 0 |");

      const workflow = readFileSync(
        ".github/workflows/visual-docs.yml",
        "utf8",
      );
      expect(workflow.indexOf("name: visual-galleries")).toBeLessThan(
        workflow.indexOf("Enforce visual drift gate after publishing"),
      );
      expect(workflow).toContain(
        "github.event.pull_request.head.repo.full_name == github.repository",
      );
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

  test("a remote change recaptures only that remote", () => {
    expect(affectedScreenshots("apps/skills/src/page.tsx")).toEqual(["skills"]);
  });

  test("a shared design-system change recaptures exactly its dependent remotes", () => {
    expect(
      affectedScreenshots("libs/design-system/src/theme.css").sort(),
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
