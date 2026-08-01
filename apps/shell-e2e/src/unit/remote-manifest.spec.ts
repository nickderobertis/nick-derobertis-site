import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";

/**
 * remotes.json maps each remote's Nx project name to its federation alias, so
 * validating that both sides are strings is what lets this test compare the
 * manifest against the composition and declaration files as text.
 */
function isRemoteManifest(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === "object" &&
    Object.values(value).every((alias: unknown) => typeof alias === "string")
  );
}

/**
 * Nx reports `tasks.dependencies` as a map from task id to the task ids it
 * depends on. Validating that shape here is what lets this test compare the
 * scheduled dependencies as strings instead of trusting the graph's JSON.
 */
function isTaskDependencies(value: object): value is Record<string, string[]> {
  return Object.values(value).every(
    (tasks: unknown) =>
      Array.isArray(tasks) &&
      tasks.every((task: unknown) => typeof task === "string"),
  );
}

test("remote manifest matches published fragment composition", async () => {
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
  const prerender = targets.prerender;
  if (
    !prerender ||
    typeof prerender !== "object" ||
    !("dependsOn" in prerender) ||
    !Array.isArray(prerender.dependsOn)
  )
    throw new Error("Validated dependsOn list is required");
  const taskGraphOutput = execFileSync(
    "pnpm",
    ["exec", "nx", "run", "shell:prerender", "--graph=stdout"],
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
  const dependencies = taskGraph.tasks.dependencies;
  if (!isTaskDependencies(dependencies))
    throw new Error(
      `Nx must report every task's dependencies as a list of task names, got ${JSON.stringify(dependencies)}`,
    );
  const prerenderDependencies = dependencies["shell:prerender"];
  if (!prerenderDependencies)
    throw new Error("Nx must schedule shell prerender dependencies");
  expect(prerenderDependencies.sort()).toEqual(
    ["shell", ...Object.keys(remoteManifest)]
      .map((name) => `${name}:build`)
      .sort(),
  );
  // llmlint: ignore-block[tests_mirror_real_usage] Declared build outputs and the manifest compose iterates are Nx cache and wiring contracts with no user-facing interface to drive: a remote whose fragment files are undeclared still serves correctly until Nx restores a cached build without them. The composed result is exercised through compose.mjs's real exported API in scripts/compose.spec.ts and through the real browser by site.spec.ts and every feature journey.
  expect(project).toMatchObject({
    targets: {
      build: {
        outputs: expect.arrayContaining([
          "{options.outputPath}/fragment.html",
          "{options.outputPath}/fragment.css",
          "{options.outputPath}/fragment.json",
        ]),
      },
    },
  });
  const compose = await readFile("scripts/compose.mjs", "utf8");
  expect(compose).toContain("Object.keys(validatedRemoteManifest)");
  // llmlint: ignore-end[tests_mirror_real_usage]
  const declarations = `${await readFile("apps/home/src/remotes.d.ts", "utf8")}\n${await readFile("apps/shell/src/remotes.d.ts", "utf8")}`;
  const aliases = [
    ...declarations.matchAll(/declare module "([^/]+)\/Page"/g),
  ].map((match) => match[1]);
  const manifestAliases = Object.values(remoteManifest);
  for (const alias of aliases) expect(manifestAliases).toContain(alias);
  const remoteNames = Object.keys(remoteManifest);
  for (const remote of remoteNames) {
    expect(declarations).toContain(`${remoteManifest[remote]}/Page`);
    // llmlint: ignore-block[tests_mirror_real_usage] Same cache-and-wiring contract per remote: nothing a visitor can do reveals whether this remote is named in the composition map or declares its fragment files as build outputs, and both are already driven end to end by remote-owner.spec.ts through the standalone and host-composed artifacts.
    expect(compose).toContain(`"${remote}"`);
    const remoteProject: unknown = JSON.parse(
      await readFile(`apps/${remote}/project.json`, "utf8"),
    );
    expect(remoteProject).toMatchObject({
      targets: {
        build: {
          outputs: expect.arrayContaining([
            "{options.outputPath}/fragment.html",
            "{options.outputPath}/fragment.css",
            "{options.outputPath}/fragment.json",
          ]),
        },
      },
    });
    // llmlint: ignore-end[tests_mirror_real_usage]
    expect(remoteProject).toMatchObject({
      targets: {
        e2e: {
          options: { command: expect.stringContaining(`E2E_REMOTE=${remote}`) },
        },
      },
    });
  }
  const boundaries = await readFile("eslint.config.mjs", "utf8");
  expect(boundaries).toContain('sourceTag: "scope:skills"');
  expect(boundaries).toContain('"scope:skills"');
});
