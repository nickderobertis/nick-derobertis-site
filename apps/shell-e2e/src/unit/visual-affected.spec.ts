import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
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

const fixtureHeadSha = "b".repeat(40);
const fixtureRepository = "owner/repository";

function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function createValidVisualArtifact(root: string): {
  artifact: string;
  captureRoot: string;
  manifestPath: string;
} {
  const artifact = path.join(root, "artifact");
  const captureRoot = path.join(artifact, "apps/bio/visual/current/x86_64");
  const sourceImage = readFileSync(
    "reference/screenshots/routes/home/desktop.png",
  );
  const hash = createHash("sha256").update(sourceImage).digest("hex");
  const shots = [];
  for (const render of ["standalone", "host-composed"])
    for (const viewport of ["desktop", "tablet", "mobile"])
      shots.push({ render, state: "happy", viewport });
  for (const state of ["empty", "loading", "error"])
    for (const render of ["standalone", "host-composed"])
      shots.push({ render, state, viewport: "desktop" });
  const manifest = {
    schema: 1,
    shots: shots.map((toggles) => {
      const image = `${toggles.render}/${toggles.state}/${toggles.viewport}.png`;
      const imagePath = path.join(captureRoot, image);
      mkdirSync(path.dirname(imagePath), { recursive: true });
      writeFileSync(imagePath, sourceImage);
      return { name: "bio", toggles, hash, image };
    }),
  };
  const manifestPath = path.join(captureRoot, "captures.json");
  writeJson(manifestPath, manifest);
  writeFileSync(path.join(artifact, "affected-visual-projects.txt"), "bio\n");
  writeJson(path.join(artifact, "visual-capture.json"), {
    schema: 1,
    repository: fixtureRepository,
    headSha: fixtureHeadSha,
    affectedCount: 1,
  });
  return { artifact, captureRoot, manifestPath };
}

function inspectArtifact(artifact: string) {
  return spawnSync(
    "node",
    [
      "scripts/inspect-visual-captures.mjs",
      artifact,
      fixtureRepository,
      fixtureHeadSha,
    ],
    { encoding: "utf8" },
  );
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
      const inspect = spawnSync(
        "node",
        [
          "scripts/inspect-visual-captures.mjs",
          root,
          "owner/repository",
          "a".repeat(40),
        ],
        { encoding: "utf8" },
      );
      expect(inspect.status).toBe(0);
      expect(inspect.stdout).toBe("has_affected=false\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test.each([
    ["same-repository", fixtureRepository],
    ["fork", "contributor/site-fork"],
  ])(
    "resolves and publishes a %s PR through trusted context",
    (_, headRepo) => {
      const root = mkdtempSync(path.join(process.cwd(), ".visual-pr-"));
      try {
        const { artifact } = createValidVisualArtifact(root);
        const pulls = JSON.stringify([
          {
            number: 12,
            state: "open",
            head: { sha: fixtureHeadSha, repo: { full_name: headRepo } },
            base: { ref: "master", repo: { full_name: fixtureRepository } },
          },
        ]);
        const context = spawnSync(
          "node",
          [
            "scripts/resolve-visual-workflow-context.mjs",
            "pull_request",
            fixtureRepository,
            fixtureHeadSha,
          ],
          { encoding: "utf8", input: pulls },
        );
        expect(context.status).toBe(0);
        expect(context.stdout).toBe(
          "event_name=pull_request\npr_number=12\nbase_ref=master\n",
        );
        const inspect = inspectArtifact(artifact);
        expect(inspect.status, inspect.stderr).toBe(0);
        const publish = spawnSync(
          "scripts/publish-visual-run.sh",
          [artifact, "pull_request", "12", "master", fixtureRepository, root],
          { encoding: "utf8" },
        );
        expect(publish.status, publish.stderr).toBe(0);
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

  test.each([
    [
      "unknown metadata",
      (fixture: ReturnType<typeof createValidVisualArtifact>) => {
        const manifest = JSON.parse(readFileSync(fixture.manifestPath, "utf8"));
        manifest.shots[0].attacker = "value";
        writeJson(fixture.manifestPath, manifest);
      },
    ],
    [
      "wrong project name",
      (fixture: ReturnType<typeof createValidVisualArtifact>) => {
        const manifest = JSON.parse(readFileSync(fixture.manifestPath, "utf8"));
        manifest.shots[0].name = "attacker";
        writeJson(fixture.manifestPath, manifest);
      },
    ],
    [
      "invalid toggles",
      (fixture: ReturnType<typeof createValidVisualArtifact>) => {
        const manifest = JSON.parse(readFileSync(fixture.manifestPath, "utf8"));
        manifest.shots[0].toggles.state = "attacker-controlled";
        writeJson(fixture.manifestPath, manifest);
      },
    ],
    [
      "hash mismatch",
      (fixture: ReturnType<typeof createValidVisualArtifact>) => {
        const manifest = JSON.parse(readFileSync(fixture.manifestPath, "utf8"));
        manifest.shots[0].hash = "0".repeat(64);
        writeJson(fixture.manifestPath, manifest);
      },
    ],
    [
      "fake PNG",
      (fixture: ReturnType<typeof createValidVisualArtifact>) => {
        const manifest = JSON.parse(readFileSync(fixture.manifestPath, "utf8"));
        const image = path.join(fixture.captureRoot, manifest.shots[0].image);
        const fake = Buffer.from("not a png");
        writeFileSync(image, fake);
        manifest.shots[0].hash = createHash("sha256")
          .update(fake)
          .digest("hex");
        writeJson(fixture.manifestPath, manifest);
      },
    ],
    [
      "duplicate shot",
      (fixture: ReturnType<typeof createValidVisualArtifact>) => {
        const manifest = JSON.parse(readFileSync(fixture.manifestPath, "utf8"));
        manifest.shots[1] = structuredClone(manifest.shots[0]);
        writeJson(fixture.manifestPath, manifest);
      },
    ],
    [
      "extra file",
      (fixture: ReturnType<typeof createValidVisualArtifact>) => {
        writeFileSync(
          path.join(fixture.captureRoot, "undeclared.txt"),
          "attacker",
        );
      },
    ],
    [
      "traversal",
      (fixture: ReturnType<typeof createValidVisualArtifact>) => {
        const manifest = JSON.parse(readFileSync(fixture.manifestPath, "utf8"));
        manifest.shots[0].image = "../outside.png";
        writeJson(fixture.manifestPath, manifest);
      },
    ],
    [
      "symlink",
      (fixture: ReturnType<typeof createValidVisualArtifact>) => {
        const manifest = JSON.parse(readFileSync(fixture.manifestPath, "utf8"));
        const image = path.join(fixture.captureRoot, manifest.shots[0].image);
        rmSync(image);
        symlinkSync("/etc/passwd", image);
      },
    ],
  ] as const)("rejects attacker-controlled %s artifacts", (_, mutate) => {
    const root = mkdtempSync(path.join(process.cwd(), ".visual-invalid-"));
    try {
      const fixture = createValidVisualArtifact(root);
      mutate(fixture);
      const inspect = inspectArtifact(fixture.artifact);
      expect(inspect.status).not.toBe(0);
      expect(inspect.stderr).not.toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("trusted follow-up workflow passes the GitHub Actions contract", () => {
    const lint = spawnSync(
      ".tools/bin/actionlint",
      [".github/workflows/visual-docs-publish.yml"],
      { encoding: "utf8" },
    );
    expect(lint.status, lint.stderr).toBe(0);
  });

  test("bootstrap provisions pinned workflow and shell linters without ambient tools", () => {
    const verify = spawnSync("scripts/setup-ci-tools.sh", ["--verify"], {
      encoding: "utf8",
      env: { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin` },
    });
    expect(verify.status, verify.stderr).toBe(0);
    expect(verify.stdout).toBe("actionlint 1.7.12, shellcheck 0.11.0\n");
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
