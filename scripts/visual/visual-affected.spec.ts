import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

// The affected-only economics of the screencomp adoption: `nx affected
// --with-target screenshot` selects which microfrontends changed, and
// scripts/visual/affected-visual-projects.mjs turns that into the dynamic `projects`
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

function verifyContractWithAwardsScenario(contents: string): {
  status: number | null;
  stderr: string;
} {
  const root = mkdtempSync(path.join(tmpdir(), "visual-scenario-contract-"));
  try {
    for (const entry of readdirSync(".")) {
      if (entry !== "apps")
        symlinkSync(path.resolve(entry), path.join(root, entry));
    }
    mkdirSync(path.join(root, "apps"));
    for (const entry of readdirSync("apps")) {
      if (entry !== "awards")
        symlinkSync(
          path.resolve("apps", entry),
          path.join(root, "apps", entry),
        );
    }
    mkdirSync(path.join(root, "apps/awards/visual"), { recursive: true });
    for (const entry of readdirSync("apps/awards")) {
      if (entry !== "visual")
        symlinkSync(
          path.resolve("apps/awards", entry),
          path.join(root, "apps/awards", entry),
        );
    }
    symlinkSync(
      path.resolve("apps/awards/visual/baseline"),
      path.join(root, "apps/awards/visual/baseline"),
    );
    writeFileSync(path.join(root, "apps/awards/visual/scenarios.ts"), contents);
    return spawnSync("node", ["scripts/visual/verify-visual-contract.mjs"], {
      cwd: root,
      encoding: "utf8",
    });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

interface VisualProject {
  id: string;
  current: string;
  verify: string;
  manifest: string;
  "gallery-title": string;
}

// The matrix arrives as a subprocess's stdout, and the reusable workflow reads
// exactly these five string fields per lane. Narrowing here means a selector
// that drops or renames one fails as a malformed matrix rather than as an
// undefined compared against an expected path.
function isVisualProject(value: unknown): value is VisualProject {
  if (typeof value !== "object" || value === null) return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    /^[a-z][a-z0-9-]*$/.test(value.id) &&
    "current" in value &&
    typeof value.current === "string" &&
    "verify" in value &&
    typeof value.verify === "string" &&
    "manifest" in value &&
    typeof value.manifest === "string" &&
    "gallery-title" in value &&
    typeof value["gallery-title"] === "string"
  );
}

function projectsMatrix(names: string[]): VisualProject[] {
  const output = execFileSync(
    "node",
    ["scripts/visual/affected-visual-projects.mjs"],
    { encoding: "utf8", input: JSON.stringify(names) },
  );
  const matrix: unknown = JSON.parse(output);
  if (!Array.isArray(matrix) || !matrix.every(isVisualProject))
    throw new Error(
      `affected-visual-projects.mjs must print a JSON array of {id, current, verify, manifest, gallery-title} lanes; received ${output}`,
    );
  return matrix;
}

// The full matrix the CI `affected` job feeds into `projects`, derived end to end
// from Nx affected selection.
function affectedProjectsMatrix(file: string): VisualProject[] {
  return projectsMatrix(affectedScreenshotProjects(file));
}

// screencomp only ever deploys <project>/<arch> and pr-<number>/<project>/<arch>,
// so a doc that advertises the bare Pages root — or drops one of the deployed
// forms — sends readers to a permanent 404. Every URL the gallery-documentation
// tests use is assembled from visual-tools.json rather than written out, so this
// file never carries a copyable dead link of its own.
function galleryContract(): {
  pagesRoot: string;
  canonical: string;
  preview: string;
} {
  const contract: unknown = JSON.parse(
    readFileSync("visual-tools.json", "utf8"),
  );
  const architecture =
    typeof contract === "object" &&
    contract !== null &&
    "architecture" in contract
      ? contract.architecture
      : undefined;
  const pagesRepository =
    typeof contract === "object" &&
    contract !== null &&
    "pagesRepository" in contract
      ? contract.pagesRepository
      : undefined;
  if (
    typeof pagesRepository !== "string" ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(pagesRepository) ||
    typeof architecture !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(architecture)
  )
    throw new Error(
      "visual-tools.json must declare an owner/name pagesRepository and an architecture",
    );
  const [owner, name] = pagesRepository.split("/");
  const pagesRoot = `https://${owner}.github.io/${name}`;
  return {
    pagesRoot,
    canonical: `${pagesRoot}/<project>/${architecture}/`,
    preview: `${pagesRoot}/pr-<number>/<project>/${architecture}/`,
  };
}

// Run the real contract gate over the committed tree with one root-level
// document swapped out. Every entry is symlinked, so only the replaced symlink is
// removed — a nested path would delete the real file through its linked
// directory, which is why this is restricted to root-level documents.
function verifyContractWithRootDocument(
  document: string,
  contents: string,
): { status: number | null; stderr: string } {
  if (document.includes("/"))
    throw new Error(`${document} must be a root-level document`);
  const root = mkdtempSync(path.join(tmpdir(), "visual-contract-"));
  try {
    for (const entry of readdirSync("."))
      symlinkSync(path.resolve(entry), path.join(root, entry));
    rmSync(path.join(root, document));
    writeFileSync(path.join(root, document), contents);
    return spawnSync("node", ["scripts/visual/verify-visual-contract.mjs"], {
      cwd: root,
      encoding: "utf8",
    });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
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
    const result = spawnSync(
      "node",
      ["scripts/visual/affected-visual-projects.mjs"],
      {
        encoding: "utf8",
        input: payload,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toBe("");
  });

  test("capture output cannot escape its owning project", () => {
    const capture = spawnSync(
      "node",
      ["apps/bio/visual/capture.ts", "/tmp/escaped-visual"],
      { encoding: "utf8" },
    );
    expect(capture.status).not.toBe(0);
    expect(capture.stderr).toContain("Output root must be inside");
  });

  test("the PR #12 reference set is mapped to per-remote baselines", () => {
    expect(() =>
      execFileSync("node", ["scripts/visual/verify-reference-migration.mjs"], {
        encoding: "utf8",
      }),
    ).not.toThrow();
  });

  test("visual tooling pins stay synchronized", () => {
    expect(() =>
      execFileSync("node", ["scripts/visual/verify-visual-contract.mjs"], {
        encoding: "utf8",
      }),
    ).not.toThrow();
  });

  test("visual scenarios cannot declare a state outside screencomp's toggle", () => {
    const invalidScenario = readFileSync(
      "apps/awards/visual/scenarios.ts",
      "utf8",
    ).replace('"all", "empty"', '"not-listed", "empty"');
    const result = verifyContractWithAwardsScenario(invalidScenario);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Visual scenario state not-listed is missing from screencomp.toml",
    );
  });

  test("gallery documentation cannot advertise the undeployed Pages root", () => {
    const { pagesRoot } = galleryContract();
    for (const deadLink of [`${pagesRoot}/`, pagesRoot]) {
      const result = verifyContractWithRootDocument(
        "README.md",
        `${readFileSync("README.md", "utf8")}\nSee the galleries at\n<${deadLink}>.\n`,
      );
      expect(result.status, deadLink).not.toBe(0);
      expect(result.stderr, deadLink).toContain("advertises the bare");
    }
  });

  test("gallery documentation must carry both deployed URL forms", () => {
    const { canonical, preview } = galleryContract();
    const result = verifyContractWithRootDocument(
      "README.md",
      readFileSync("README.md", "utf8").replaceAll(canonical, preview),
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`must document ${canonical}`);
  });

  // screencomp's capture callback reaches CI through `with:`, where actionlint
  // never shellchecks it, so `just lint-workflows` extracts it to disk first.
  // An extractor that silently wrote nothing would hand shellcheck an empty
  // directory and report a clean gate over an unlinted callback.
  // llmlint: ignore-block[work_goes_through_command_surface] just lint-workflows pipes this extractor into shellcheck and deletes the directory it wrote, so the recipe can prove neither what was extracted nor that a bad output root is refused. These two cases drive the CLI the recipe runs, against the same committed workflow, to cover exactly what the recipe cannot observe.
  test("the callback extractor writes the injected capture script shellcheck reads", () => {
    const output = mkdtempSync(path.join(tmpdir(), "injected-callbacks-"));
    try {
      const result = spawnSync(
        "node",
        ["scripts/visual/extract-injected-callbacks.mjs", output],
        { encoding: "utf8" },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(readdirSync(output)).toEqual(["capture-command.sh"]);
      expect(
        readFileSync(path.join(output, "capture-command.sh"), "utf8"),
      ).toContain("SCREENCOMP_PROJECT");
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  });

  test("the callback extractor refuses an output directory it did not receive", () => {
    const result = spawnSync(
      "node",
      ["scripts/visual/extract-injected-callbacks.mjs", "relative/output"],
      { encoding: "utf8" },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("extract-injected-callbacks:");
  });
  // llmlint: ignore-end[work_goes_through_command_surface]

  test("bootstrap provisions pinned workflow and shell linters without ambient tools", () => {
    const verify = spawnSync("scripts/ci/setup-ci-tools.sh", ["--verify"], {
      encoding: "utf8",
      env: { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin` },
    });
    expect(verify.status, verify.stderr).toBe(0);
    expect(verify.stdout).toBe("actionlint 1.7.12, shellcheck 0.11.0\n");
  });
});
