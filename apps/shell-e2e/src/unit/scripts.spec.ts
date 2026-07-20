import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const workspace = process.cwd();
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("script entry-point errors", () => {
  it("rejects an invalid server port with a recovery action", () => {
    const result = spawnSync(process.execPath, ["scripts/serve-e2e.mjs"], {
      cwd: workspace,
      env: { ...process.env, PORT: "not-a-port" },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("PORT must be an integer from 1 to 65535");
    expect(result.stderr).toContain("run just test-e2e again");
  });

  it("reports a missing remote build and the recovery command", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "site-prerender-"));
    temporaryDirectories.push(fixture);
    const output = join(fixture, "output");
    const builds = join(fixture, "builds");
    await mkdir(output, { recursive: true });
    await mkdir(builds, { recursive: true });
    await cp("dist/apps/shell/index.html", join(output, "index.html"));
    const result = spawnSync(process.execPath, ["scripts/prerender.mjs"], {
      cwd: workspace,
      env: {
        ...process.env,
        PRERENDER_OUTPUT: output,
        REMOTE_BUILD_ROOT: builds,
      },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing built remote");
    expect(result.stderr).toContain("Run just check");
  });
});

describe("remote manifest drift", () => {
  it("matches the shell prerender build dependencies", async () => {
    const manifest = JSON.parse(
      await readFile("libs/build-config/src/remotes.json", "utf8"),
    ) as Record<string, string>;
    const project = JSON.parse(
      await readFile("apps/shell/project.json", "utf8"),
    ) as {
      targets: { prerender: { dependsOn: Array<{ projects?: string[] }> } };
    };
    const projects = project.targets.prerender.dependsOn.flatMap(
      (dependency) => dependency.projects ?? [],
    );
    expect(projects.sort()).toEqual(Object.keys(manifest).sort());
  });
});
