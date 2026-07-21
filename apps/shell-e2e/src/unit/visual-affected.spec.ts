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
  test("zero affected projects produce an explicit signal and no publication work", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".visual-zero-"));
    try {
      writeFileSync(path.join(root, "affected-visual-projects.txt"), "");
      const signal = spawnSync(
        "node",
        [path.resolve("scripts/write-visual-capture-signal.mjs")],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            CAPTURE_HEAD_SHA: "a".repeat(40),
            CAPTURE_REPOSITORY: "owner/repository",
          },
        },
      );
      expect(signal.status).toBe(0);
      const output = path.join(root, "output.txt");
      const inspect = spawnSync(
        "node",
        [
          "scripts/inspect-visual-captures.mjs",
          root,
          "owner/repository",
          "a".repeat(40),
          output,
        ],
        { encoding: "utf8" },
      );
      expect(inspect.status).toBe(0);
      expect(readFileSync(output, "utf8")).toBe("has_affected=false\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test.each(["same-repository", "fork"])(
    "%s PR captures use the trusted publication path",
    () => {
      const root = mkdtempSync(path.join(process.cwd(), ".visual-pr-"));
      try {
        const artifact = path.join(root, "artifact");
        const current = path.join(artifact, "apps/bio/visual/current/x86_64");
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
                name: "bio",
                toggles,
                hash: "b".repeat(64),
                image: "standalone/happy/desktop.png",
              },
            ],
          }),
        );
        mkdirSync(path.join(current, "standalone/happy"), { recursive: true });
        copyFileSync(
          path.join(current, "desktop.png"),
          path.join(current, "standalone/happy/desktop.png"),
        );
        writeFileSync(
          path.join(artifact, "affected-visual-projects.txt"),
          "bio\n",
        );
        writeFileSync(
          path.join(artifact, "visual-capture.json"),
          JSON.stringify({
            schema: 1,
            repository: "owner/repository",
            headSha: "b".repeat(40),
            affectedCount: 1,
          }),
        );
        const output = path.join(root, "output.txt");
        expect(
          spawnSync(
            "node",
            [
              "scripts/inspect-visual-captures.mjs",
              artifact,
              "owner/repository",
              "b".repeat(40),
              output,
            ],
            { encoding: "utf8" },
          ).status,
        ).toBe(0);
        const publish = spawnSync(
          "scripts/publish-visual-run.sh",
          [artifact, "pull_request", "12", "master", "owner/repository", root],
          { encoding: "utf8" },
        );
        expect(publish.status).toBe(0);
        expect(
          readFileSync(path.join(root, "site/bio/index.html"), "utf8"),
        ).toContain("bio");
        expect(readFileSync(path.join(root, "comment.md"), "utf8")).toContain(
          "Visual changes",
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  test("trusted follow-up never executes fork code and has no fork comment guard", () => {
    const workflow = readFileSync(
      ".github/workflows/visual-docs-publish.yml",
      "utf8",
    );
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("ref: master");
    expect(workflow).toContain(
      "run-id: $" + "{{ github.event.workflow_run.id }}",
    );
    expect(workflow).not.toContain("head.repo.full_name");
    expect(workflow).toContain("commits/$HEAD_SHA/pulls");
    expect(workflow).toContain("needs.inspect.outputs.has_affected == 'true'");
  });

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
