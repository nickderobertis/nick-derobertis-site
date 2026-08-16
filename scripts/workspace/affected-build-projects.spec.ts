import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runAffectedBuildProjects(file: string) {
  return spawnSync("just", ["affected-build-projects", file], {
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
      `just affected-build-projects must print a JSON array of Nx project names; its last line was ${JSON.stringify(printed)}`,
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
      `just affected-build-projects must print a JSON array of Nx project names; received ${printed}`,
    );
  return parsed;
}

describe("affected build economics proof", () => {
  it("limits an awards emblem edit to the awards remote", () => {
    const result = runAffectedBuildProjects("apps/awards/src/award-emblem.tsx");

    expect(result.status).toBe(0);
    expect(selectedProjects(result.stdout)).toEqual(["awards"]);
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
