import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runAffectedBuildProjects(file: string) {
  return spawnSync("just", ["affected-build-projects", file], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function runAffectedPrerenderProjects(file: string) {
  return spawnSync("just", ["affected-prerender-projects", file], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

// The recipe echoes its own command line ahead of Nx's JSON, so the selection is
// the last line. Whatever that line turns out to be is subprocess output, not a
// project list: it is narrowed to the array of Nx project names these
// assertions read, so a recipe that starts printing something else fails here
// instead of being compared as an opaque value.
function selectedProjects(stdout: string): string[] {
  const printed = stdout.trim().split("\n").at(-1) ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(printed);
  } catch {
    throw new Error(
      `an affected-projects recipe must print a JSON array of Nx project names; its last line was ${JSON.stringify(printed)}`,
    );
  }
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (project) =>
        typeof project === "string" && /^[a-z][a-z0-9-]*$/.test(project),
    )
  )
    throw new Error(
      `an affected-projects recipe must print a JSON array of Nx project names; received ${printed}`,
    );
  return parsed;
}

describe("affected build economics proof", () => {
  it("limits an awards emblem edit to the awards remote and the workspace linter", () => {
    const result = runAffectedBuildProjects("apps/awards/src/award-emblem.tsx");

    expect(result.status).toBe(0);
    // No other remote is selected. The shell is, for a reason that has nothing
    // to do with its own bytes: it owns the workspace's single eslint run,
    // whose key covers every TypeScript file, and Nx marks a project affected
    // rather than a target. Its build replays from cache, since none of its own
    // inputs moved; what the edit really buys is the eslint pass that has to
    // see it.
    expect([...selectedProjects(result.stdout)].sort()).toEqual([
      "awards",
      "shell",
    ]);
  });

  it.each([
    ["apps/software/src/software.css", ["software"]],
    ["apps/home-carousel/src/carousel.css", ["home-carousel"]],
  ])("limits an owned style edit: %s", (file, expected) => {
    const result = runAffectedBuildProjects(file);

    expect(result.status).toBe(0);
    expect(selectedProjects(result.stdout)).toEqual(expected);
  });

  it("limits a publish-path edit to the library that owns it", () => {
    const result = runAffectedBuildProjects(
      "libs/publish-config/src/publish-fragment.ts",
    );

    expect(result.status).toBe(0);
    expect(selectedProjects(result.stdout)).toEqual(["publish-config"]);
  });

  it("reports the real Nx build graph for a shared data contract", () => {
    const result = runAffectedBuildProjects(
      "libs/data-access-core/src/client.ts",
    );

    expect(result.status).toBe(0);
    expect(selectedProjects(result.stdout)).toEqual(
      expect.arrayContaining([
        "data-access-core",
        "data-access-awards",
        "awards",
        "data-access-home",
        "home",
      ]),
    );
  });

  it.each(["../package.json", "missing-file.ts"])(
    "rejects an unsafe or missing workspace file: %s",
    (file) => {
      const result = runAffectedBuildProjects(file);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain("file must be a workspace-relative file");
    },
  );
});

describe("affected prerender economics proof", () => {
  it("recomposes the artifact for a remote's source edit and nothing else", () => {
    const result = runAffectedPrerenderProjects("apps/awards/src/page.tsx");

    expect(result.status).toBe(0);
    // The shell owns the only prerender target, so it is the whole answer when
    // an edit reaches composition at all. What this proves is that the answer
    // is not empty: the awards bytes the composed artifact serves are rebuilt
    // and recomposed, rather than left as whatever the last compose wrote.
    expect(selectedProjects(result.stdout)).toEqual(["shell"]);
  });

  it("leaves the artifact alone for a file no build or compose step reads", () => {
    // Documentation is in no target's key, so it selects no prerender. Without
    // this case the assertion above would pass for a recipe that answered
    // ["shell"] unconditionally.
    const result = runAffectedPrerenderProjects("docs/architecture.md");

    expect(result.status).toBe(0);
    expect(selectedProjects(result.stdout)).toEqual([]);
  });

  it.each(["../package.json", "missing-file.ts"])(
    "rejects an unsafe or missing workspace file: %s",
    (file) => {
      const result = runAffectedPrerenderProjects(file);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain("file must be a workspace-relative file");
    },
  );
});
