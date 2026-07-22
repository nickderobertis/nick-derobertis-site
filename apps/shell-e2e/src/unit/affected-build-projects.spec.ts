import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runAffectedBuildProjects(file: string) {
  return spawnSync("just", ["affected-build-projects", file], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

describe("affected build economics proof", () => {
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
