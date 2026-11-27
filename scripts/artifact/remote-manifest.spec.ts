import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { expect, test } from "vitest";

/**
 * remotes.json maps each remote's Nx project name to its federation alias, so
 * validating that both sides are strings is what lets this test compare the
 * manifest against the composition file as text and against the declarations
 * each remote's build compiles from its exposes.
 */
function isRemoteManifest(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === "object" &&
    Object.values(value).every((alias: unknown) => typeof alias === "string")
  );
}

/**
 * Nx reports `tasks.dependencies` as a map from task id to the tasks it
 * depends on, each named by a task-id string (Nx 23) or an `{ id }` object
 * (Nx 24). Either is read down to the task-id strings, so this test compares
 * the scheduled dependencies as strings, and any other shape is refused rather
 * than guessed at.
 */
function taskDependencyNames(
  value: object,
): Record<string, string[]> | undefined {
  const names: Record<string, string[]> = {};
  for (const [task, dependencies] of Object.entries(value)) {
    if (!Array.isArray(dependencies)) return undefined;
    const named: string[] = [];
    // `Array.isArray` narrows to `any[]`, which would let an element through
    // unchecked; widening it to `unknown[]` makes every element pass the
    // guards below before it is read.
    for (const dependency of dependencies as unknown[]) {
      if (typeof dependency === "string") named.push(dependency);
      else if (
        dependency &&
        typeof dependency === "object" &&
        "id" in dependency &&
        typeof dependency.id === "string"
      )
        named.push(dependency.id);
      else return undefined;
    }
    names[task] = named;
  }
  return names;
}

// Computing the task graph below is a real spawn with the Nx daemon disabled,
// and its duration tracks the machine's load rather than this test's own work:
// it clears the runner's 5000ms default only on an idle host. A setup hook
// would need the same raise under `hookTimeout`, so the ceiling goes here.
test("remote manifest matches published fragment composition", {
  timeout: 120_000,
}, async () => {
  const remoteManifest: unknown = JSON.parse(
    await readFile("libs/build-config/src/remotes.json", "utf8"),
  );
  const project: unknown = JSON.parse(
    await readFile("apps/shell/project.json", "utf8"),
  );
  if (!isRemoteManifest(remoteManifest))
    throw new Error(
      `remotes.json must map every remote name to a federation alias string, got ${JSON.stringify(remoteManifest)}`,
    );
  if (!project || typeof project !== "object" || !("targets" in project))
    throw new Error("Validated shell project object is required");
  const targets = project.targets;
  if (!targets || typeof targets !== "object" || !("prerender" in targets))
    throw new Error("Validated prerender target is required");
  // scripts/workspace/federation-plugin.mjs derives every remote's build onto
  // this target, so the fan-in exists only in the resolved graph and there is no
  // declaration to compare against. What Nx actually schedules is read instead.
  // llmlint: ignore-block[tests_mirror_real_usage] Which builds Nx schedules ahead of shell:prerender is a scheduling contract with no user-visible interface to drive: a prerender that rebuilds every remote from source and one that composes their published fragments emit the same bytes, so nothing a visitor can do distinguishes them, and only the graph reveals that an app-only change no longer drags the other twelve units into the deploy. The artifact those builds produce is driven through the real browser by site.spec.ts and every feature journey.
  const taskGraphOutput = execFileSync(
    "bun",
    ["x", "nx", "run", "shell:prerender", "--graph=stdout"],
    {
      encoding: "utf8",
      env: { ...process.env, NX_DAEMON: "false" },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  const taskGraph: unknown = JSON.parse(taskGraphOutput);
  if (
    !taskGraph ||
    typeof taskGraph !== "object" ||
    !("tasks" in taskGraph) ||
    !taskGraph.tasks ||
    typeof taskGraph.tasks !== "object" ||
    !("dependencies" in taskGraph.tasks) ||
    !taskGraph.tasks.dependencies ||
    typeof taskGraph.tasks.dependencies !== "object"
  )
    throw new Error("Nx must return a validated task dependency graph");
  const dependencies = taskDependencyNames(taskGraph.tasks.dependencies);
  if (!dependencies)
    throw new Error(
      `Nx must report every task's dependencies as a list of task names or task ids, got ${JSON.stringify(taskGraph.tasks.dependencies)}`,
    );
  const prerenderDependencies = dependencies["shell:prerender"];
  if (!prerenderDependencies)
    throw new Error("Nx must schedule shell prerender dependencies");
  expect(prerenderDependencies.sort()).toEqual(
    ["shell", ...Object.keys(remoteManifest)]
      .map((name) => `${name}:build`)
      .sort(),
  );
  // llmlint: ignore-end[tests_mirror_real_usage]
  // llmlint: ignore-block[tests_mirror_real_usage] Declared build outputs and the manifest compose iterates are Nx cache and wiring contracts with no user-facing interface to drive: a remote whose fragment files are undeclared still serves correctly until Nx restores a cached build without them. The composed result is exercised through compose.mjs's real exported API in scripts/compose/compose.spec.ts and through the real browser by site.spec.ts and every feature journey.
  expect(project).toMatchObject({
    targets: {
      build: {
        outputs: expect.arrayContaining([
          "{workspaceRoot}/dist/apps/shell/fragment.html",
          "{workspaceRoot}/dist/apps/shell/fragment.css",
          "{workspaceRoot}/dist/apps/shell/fragment.json",
        ]),
      },
    },
  });
  const compose = await readFile("scripts/compose/compose.mjs", "utf8");
  expect(compose).toContain("Object.keys(validatedRemoteManifest)");
  // llmlint: ignore-end[tests_mirror_real_usage]
  // Every remote's build compiles its own exposes into this tree, keyed by the
  // federation alias its hosts import, so the declarations a host typechecks
  // against are exactly the set this manifest names. The prerender this test
  // depends on builds every remote, so the tree is complete by the time it runs.
  // llmlint: ignore-block[boundary_inputs_validated] Neither listing read below is external input: `dist/mf-types/remotes` is written by this workspace's own remote builds, which the prerender this test depends on has just run, and `remoteManifest` is the committed registry `remote-registry.ts` parses and `just lint-workflows` re-derives from the project graph. Both are then validated by use rather than ahead of it, which is what this gate is: an alias naming no published declaration tree, or a remote naming no `apps/<name>/project.json`, fails its read and fails this test with the path it looked for. Holding them to a name grammar first would only turn those failures into a narrower list restating the grammar `federation-registry.mjs` already enforces on the same names before they reach the registry.
  const publishedAliases = (await readdir("dist/mf-types/remotes")).filter(
    (entry) => !entry.endsWith(".zip"),
  );
  const manifestAliases = Object.values(remoteManifest);
  for (const alias of publishedAliases)
    expect(manifestAliases).toContain(alias);
  const remoteNames = Object.keys(remoteManifest);
  for (const remote of remoteNames) {
    await expect(
      readFile(
        `dist/mf-types/remotes/${remoteManifest[remote]}/Page.d.ts`,
        "utf8",
      ),
    ).resolves.toContain(`./compiled-types/apps/${remote}/src/page`);
    // llmlint: ignore-block[tests_mirror_real_usage] Same cache-and-wiring contract per remote: nothing a visitor can do reveals whether this remote is named in the composition map or declares its fragment files as build outputs, and both are already driven end to end by each app's ownership.spec.ts through the standalone and host-composed artifacts.
    expect(compose).toContain(`"${remote}"`);
    const remoteProject: unknown = JSON.parse(
      await readFile(`apps/${remote}/project.json`, "utf8"),
    );
    expect(remoteProject).toMatchObject({
      targets: {
        build: {
          outputs: expect.arrayContaining([
            `{workspaceRoot}/dist/apps/${remote}/fragment.html`,
            `{workspaceRoot}/dist/apps/${remote}/fragment.css`,
            `{workspaceRoot}/dist/apps/${remote}/fragment.json`,
          ]),
        },
      },
    });
    // llmlint: ignore-end[tests_mirror_real_usage]
    expect(remoteProject).toMatchObject({
      targets: {
        e2e: {
          options: {
            command: expect.stringContaining(
              `apps/${remote}/e2e/playwright.config.ts`,
            ),
          },
        },
      },
    });
  }
  // llmlint: ignore-end[boundary_inputs_validated]
});
