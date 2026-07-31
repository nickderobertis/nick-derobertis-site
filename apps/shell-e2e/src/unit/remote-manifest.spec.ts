import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";

test("remote manifest matches published fragment composition", async () => {
  const manifest: unknown = JSON.parse(
    await readFile("libs/build-config/src/remotes.json", "utf8"),
  );
  const project: unknown = JSON.parse(
    await readFile("apps/shell/project.json", "utf8"),
  );
  if (
    !manifest ||
    typeof manifest !== "object" ||
    Object.values(manifest).some((value) => typeof value !== "string") ||
    !project ||
    typeof project !== "object" ||
    !("targets" in project)
  )
    throw new Error("Validated manifest and project objects are required");
  const remoteManifest = manifest as Record<string, string>;
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
  const dependencies = taskGraph.tasks.dependencies as Record<string, string[]>;
  const prerenderDependencies = dependencies["shell:prerender"];
  if (!prerenderDependencies)
    throw new Error("Nx must schedule shell prerender dependencies");
  expect(prerenderDependencies.sort()).toEqual(
    ["shell", ...Object.keys(remoteManifest)]
      .map((name) => `${name}:build`)
      .sort(),
  );
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
  const declarations = `${await readFile("apps/home/src/remotes.d.ts", "utf8")}\n${await readFile("apps/shell/src/remotes.d.ts", "utf8")}`;
  const aliases = [
    ...declarations.matchAll(/declare module "([^/]+)\/Page"/g),
  ].map((match) => match[1]);
  const manifestAliases = Object.values(remoteManifest);
  for (const alias of aliases) expect(manifestAliases).toContain(alias);
  const remoteNames = Object.keys(remoteManifest);
  for (const remote of remoteNames) {
    expect(declarations).toContain(`${remoteManifest[remote]}/Page`);
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
