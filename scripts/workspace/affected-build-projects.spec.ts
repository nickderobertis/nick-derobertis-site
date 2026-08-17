import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

// Project names come back from Nx and go into assertion messages, so they are
// narrowed to the same grammar the printed selections are held to below.
const projectName = z.string().regex(/^[a-z][a-z0-9-]*$/);

const graphSchema = z.object({
  graph: z.object({
    nodes: z.record(
      projectName,
      z.object({
        data: z.object({
          targets: z.record(z.string(), z.unknown()).optional(),
        }),
      }),
    ),
    dependencies: z.record(
      projectName,
      z.array(z.object({ target: z.string() })),
    ),
  }),
});

/** Who depends on whom, and which projects declare a build, per Nx's graph. */
let dependencies: Record<string, string[]> = {};
let buildingProjects = new Set<string>();

beforeAll(() => {
  const graphFile = join(
    mkdtempSync(join(tmpdir(), "affected-build-projects-")),
    "graph.json",
  );
  execFileSync("pnpm", ["exec", "nx", "graph", `--file=${graphFile}`], {
    encoding: "utf8",
    stdio: "pipe",
  });
  const { graph } = graphSchema.parse(
    JSON.parse(readFileSync(graphFile, "utf8")),
  );
  dependencies = Object.fromEntries(
    Object.entries(graph.dependencies).map(([project, edges]) => [
      project,
      edges.map((edge) => edge.target),
    ]),
  );
  buildingProjects = new Set(
    Object.entries(graph.nodes)
      .filter(([, node]) => "build" in (node.data.targets ?? {}))
      .map(([project]) => project),
  );
  // A graph that resolved no build target would pass the graph case for free.
  expect(buildingProjects.size).toBeGreaterThan(0);
});

/**
 * Every project that reaches `dependency`, directly or through another project.
 * Nx selects a project for an edit to anything it depends on transitively, so
 * anything short of the transitive set would miss the leak worth catching.
 */
function dependentsOf(dependency: string): string[] {
  const reaching = new Set<string>();
  let added = true;
  while (added) {
    added = false;
    for (const [project, targets] of Object.entries(dependencies)) {
      if (reaching.has(project)) continue;
      const reaches = targets.some(
        (target) => target === dependency || reaching.has(target),
      );
      if (!reaches) continue;
      reaching.add(project);
      added = true;
    }
  }
  return [...reaching].sort();
}

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

  it("limits a publish-path edit to the library that owns it and the workspace linter", () => {
    const result = runAffectedBuildProjects(
      "libs/publish-config/src/publish-fragment.ts",
    );

    expect(result.status).toBe(0);
    // No app is selected: before the publish path was split out of
    // build-config, this edit selected twenty projects, thirteen of them app
    // builds. The shell is selected for the same reason it is on the awards
    // case above and for no other — `eslint .` reads this file — and its own
    // build replays from cache. That reason is a workspace-lint constant, not
    // a publish-path edge, which is what the graph case below holds it to.
    expect([...selectedProjects(result.stdout)].sort()).toEqual([
      "publish-config",
      "shell",
    ]);
  });

  it("gives no project that builds a dependency on the publish path", () => {
    // The assertion above admits the shell on the strength of the linter
    // reading every TypeScript file. Alone it would keep passing if the shell
    // grew a real dependency on the publish path, which is the leak the split
    // exists to close and would restore an app build to a publish lane's cost.
    // What that admission is worth is therefore stated separately, against the
    // graph rather than against one file's selection.
    const building = dependentsOf("publish-config").filter((project) =>
      buildingProjects.has(project),
    );

    expect(building).toEqual([]);
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
