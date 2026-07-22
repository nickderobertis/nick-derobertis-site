import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runAffectedBuildProjects(file: string) {
  return spawnSync("just", ["affected-build-projects", file], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

describe("affected build economics proof", () => {
  it("limits an awards emblem edit to the awards remote", () => {
    const result = runAffectedBuildProjects("apps/awards/src/award-emblem.tsx");

    expect(result.status).toBe(0);
    expect(
      JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "null"),
    ).toEqual(["awards"]);
  });

  it.each([
    ["apps/software/src/software.css", ["software"]],
    ["apps/home-carousel/src/carousel.css", ["home-carousel"]],
  ])("limits an owned style edit: %s", (file, expected) => {
    const result = runAffectedBuildProjects(file);

    expect(result.status).toBe(0);
    expect(
      JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "null"),
    ).toEqual(expected);
  });

  it("reports the real Nx build graph for a shared data contract", () => {
    const result = runAffectedBuildProjects(
      "libs/data-access-core/src/client.ts",
    );

    expect(result.status).toBe(0);
    const projects = JSON.parse(
      result.stdout.trim().split("\n").at(-1) ?? "null",
    ) as unknown;
    expect(projects).toEqual(
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
