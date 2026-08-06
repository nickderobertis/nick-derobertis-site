import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * The conventions the workspace is built on — one owned browser suite and one
 * visual inventory per app, a co-located component spec beside every component,
 * and a coverage floor no project may opt out of — are invisible to every other
 * gate: a new app with no `e2e/` still builds, a component with no spec still
 * renders, and a `test` target that passes with no tests still reports green.
 * This spec is what makes them fail instead, and it derives every subject from
 * the real Nx project graph so a project added tomorrow is covered the day it
 * is added rather than when someone remembers to extend a list here.
 */

const targetSchema = z.object({
  options: z.object({ command: z.string().optional() }).optional(),
});

const projectSchema = z.object({
  root: z.string(),
  sourceRoot: z.string().optional(),
  tags: z.array(z.string()).optional(),
  targets: z.record(z.string(), targetSchema).optional(),
});

const graphSchema = z.object({
  graph: z.object({
    nodes: z.record(z.string(), z.object({ data: projectSchema })),
  }),
});

type Project = z.infer<typeof projectSchema> & { name: string };

let projects: Project[] = [];

beforeAll(() => {
  const graphFile = join(
    mkdtempSync(join(tmpdir(), "structure-contract-")),
    "graph.json",
  );
  execFileSync("pnpm", ["exec", "nx", "graph", `--file=${graphFile}`], {
    encoding: "utf8",
    env: { ...process.env, NX_DAEMON: "false" },
    stdio: "pipe",
  });
  const graph = graphSchema.parse(
    JSON.parse(readFileSync(graphFile, "utf8")) as unknown,
  );
  projects = Object.entries(graph.graph.nodes).map(([name, node]) => ({
    name,
    ...node.data,
  }));
});

function withTarget(target: string) {
  return projects.filter((project) => project.targets?.[target]);
}

// A `test` target names its Vitest config on the command line, and the coverage
// floor is read by importing that config. The path comes out of the project
// graph, so it is narrowed to a workspace-relative Vitest config before it is
// resolved and imported.
const vitestConfigPath = z
  .string()
  .regex(/^(?:[a-z0-9-]+\/)+vite(?:\.[a-z0-9-]+)?\.config\.ts$/);

// `just --summary` prints the recipe names, and each is interpolated into the
// pattern that finds the spec driving it, so they are narrowed first.
const recipeName = z.string().regex(/^[a-z][a-z0-9-]*$/);

function targetCommand(project: Project, target: string) {
  const command = project.targets?.[target]?.options?.command;
  if (command === undefined)
    throw new Error(
      `${project.name} declares a ${target} target with no command; give it an nx:run-commands command so this contract can read what it runs.`,
    );
  return command;
}

/** Every file below `directory`, relative to the workspace root. */
function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe("app project structure", () => {
  it("gives every app its own component config and browser suite", () => {
    const missing = projects
      .filter((project) => project.root.startsWith("apps/"))
      .flatMap((project) =>
        [
          `${project.root}/vite.config.ts`,
          `${project.root}/e2e/playwright.config.ts`,
        ]
          .filter((path) => !existsSync(path))
          .map((path) => `${project.name} is missing ${path}`),
      );
    expect(missing).toEqual([]);
  });

  it("keeps at least one owned journey beside every app's Playwright config", () => {
    const empty = projects
      .filter((project) => existsSync(`${project.root}/e2e`))
      .filter(
        (project) =>
          !readdirSync(`${project.root}/e2e`).some((entry) =>
            entry.endsWith(".spec.ts"),
          ),
      )
      .map(
        (project) => `${project.name} owns no journey in ${project.root}/e2e`,
      );
    expect(empty).toEqual([]);
  });

  it("gives every screenshot project its own visual scenario inventory", () => {
    const missing = withTarget("screenshot")
      .filter((project) => !existsSync(`${project.root}/visual/scenarios.ts`))
      .map(
        (project) =>
          `${project.name} is missing ${project.root}/visual/scenarios.ts`,
      );
    expect(missing).toEqual([]);
  });
});

describe("test target contract", () => {
  it("lets no project pass its test target with no tests", () => {
    const permissive = withTarget("test")
      .filter((project) =>
        targetCommand(project, "test").includes("--passWithNoTests"),
      )
      .map((project) => `${project.name} passes --passWithNoTests`);
    expect(permissive).toEqual([]);
  });

  it("runs every project's tests through a named Vitest config", () => {
    const unnamed = withTarget("test")
      .filter(
        (project) => !/--config\s+\S+/.test(targetCommand(project, "test")),
      )
      .map(
        (project) =>
          `${project.name} runs vitest without --config, so its coverage floor cannot be read`,
      );
    expect(unnamed).toEqual([]);
  });

  it("leaves no spec in a project that never runs it", () => {
    const orphaned = projects
      .filter((project) => project.sourceRoot && !project.targets?.test)
      .filter((project) =>
        walk(project.sourceRoot ?? "").some((path) =>
          /\.spec\.tsx?$/.test(path),
        ),
      )
      .map(
        (project) =>
          `${project.name} has specs under ${project.sourceRoot} but no test target to run them`,
      );
    expect(orphaned).toEqual([]);
  });
});

describe("coverage floor", () => {
  // The tooling projects drive `just` recipes, hooks, and CLIs as real
  // subprocesses, which v8 cannot instrument from the parent process, so their
  // gate is the subject inventory below rather than a percentage.
  const exemptFromCoverage = (project: Project) =>
    project.name.startsWith("tooling-");

  it("holds every non-tooling project to 95 on all four metrics", async () => {
    const configured = await Promise.all(
      withTarget("test")
        .filter((project) => !exemptFromCoverage(project))
        .map(async (project) => {
          const config = /--config\s+(\S+)/.exec(
            targetCommand(project, "test"),
          )?.[1];
          const named = vitestConfigPath.safeParse(config);
          if (!named.success)
            return `${project.name} names no workspace Vitest config to read its coverage floor from`;
          const module: unknown = await import(
            pathToFileURL(resolve(named.data)).href
          );
          const thresholds = z
            .object({
              default: z.object({
                test: z.object({
                  coverage: z.object({
                    thresholds: z.record(z.string(), z.unknown()),
                  }),
                }),
              }),
            })
            .safeParse(module);
          if (!thresholds.success)
            return `${project.name} declares no coverage thresholds in ${named.data}`;
          const declared = thresholds.data.default.test.coverage.thresholds;
          const below = ["lines", "functions", "branches", "statements"].filter(
            (metric) => declared[metric] !== 95,
          );
          return below.length === 0
            ? undefined
            : `${project.name} does not hold ${below.join(", ")} at 95 in ${named.data}`;
        }),
    );
    expect(configured.filter((finding) => finding !== undefined)).toEqual([]);
  });
});

describe("component spec colocation", () => {
  // Both export forms the workspace uses for a React component: a default
  // export and a named uppercase one. A lowercase named export is a helper or
  // a build entry, which the project's own coverage floor already covers.
  const componentExport =
    /^export\s+default\s+function\b|^export\s+(?:async\s+)?function\s+[A-Z]|^export\s+const\s+[A-Z]/m;

  it("puts a spec beside every component", () => {
    const uncovered = projects
      .flatMap((project) => walk(project.sourceRoot ?? ""))
      .filter((path) => path.endsWith(".tsx") && !path.endsWith(".spec.tsx"))
      .filter((path) => componentExport.test(readFileSync(path, "utf8")))
      .filter((path) => !existsSync(path.replace(/\.tsx$/, ".spec.tsx")))
      .map((path) => `${path} exports a component with no co-located spec`);
    expect(uncovered).toEqual([]);
  });
});

describe("tooling subject inventory", () => {
  /**
   * A `just` recipe that only dispatches an Nx target, mutates the developer's
   * environment, or hands its arguments to a pinned external CLI has no
   * behavior of its own for a spec to drive; the dispatched target, the
   * installer's own subprocess tests, or the external tool owns it. Every other
   * recipe must be named by a spec, so adding one with logic fails here until a
   * tooling project claims it.
   */
  const undrivenRecipes: Record<string, string> = {
    "bootstrap-ci": "installs dependencies and pinned CI tools into the runner",
    "check-all": "dispatches every Nx target for every project",
    "e2e-affected-files":
      "dispatches Nx affected selection and its e2e targets",
    "e2e-project": "dispatches one project's Nx e2e target",
    format: "rewrites the working tree with Biome",
    gate: "aliases check with no behavior of its own",
    lint: "dispatches the Nx lint and typecheck targets",
    "lint-llm": "hands the whole tree to the pinned llmlint CLI",
    "lint-llm-validate": "hands its arguments to the pinned llmlint CLI",
    "perf-check-report":
      "dispatches performance-audit.mjs, whose own spec owns the report contract",
    prerender: "dispatches the Nx shell prerender target",
    serve: "dispatches serve-e2e.mjs, whose own spec owns the served contract",
    "setup-llm-harness":
      "installs the pinned harness into the developer's PATH",
    test: "dispatches the Nx test and e2e targets",
    "test-e2e": "dispatches the shell Nx e2e target",
    upgrade: "updates every dependency to its latest release",
  };

  function toolingSpecs() {
    return walk("scripts")
      .filter((path) => path.endsWith(".spec.ts"))
      .map((path) => readFileSync(path, "utf8"));
  }

  it("names every workspace script in the tooling project that owns it", () => {
    const specsByProject = new Map<string, string[]>();
    for (const path of walk("scripts").filter((file) =>
      file.endsWith(".spec.ts"),
    )) {
      const project = path.split("/").slice(0, 2).join("/");
      specsByProject.set(project, [
        ...(specsByProject.get(project) ?? []),
        readFileSync(path, "utf8"),
      ]);
    }
    const unowned = walk("scripts")
      .filter((path) => path.endsWith(".mjs"))
      .filter((path) => {
        const project = path.split("/").slice(0, 2).join("/");
        const name = relative(project, path);
        return !(specsByProject.get(project) ?? []).some((spec) =>
          spec.includes(name),
        );
      })
      .map((path) => `${path} is named by no spec in its own tooling project`);
    expect(unowned).toEqual([]);
  });

  it("names every git hook in a tooling spec", () => {
    const specs = toolingSpecs();
    const unowned = walk(".githooks")
      .filter((path) => !specs.some((spec) => spec.includes(path)))
      .map((path) => `${path} is driven by no tooling spec`);
    expect(unowned).toEqual([]);
  });

  it("either drives every just recipe or records why it cannot", () => {
    const specs = toolingSpecs();
    const recipes = recipeName
      .array()
      .parse(
        execFileSync("just", ["--summary"], { encoding: "utf8" })
          .trim()
          .split(/\s+/),
      );
    const findings = recipes
      .filter((recipe) => {
        // A spec drives a recipe through `just`, or names it in the diagnostic
        // it asserts; either way the recipe is claimed by a tooling project.
        const driven = new RegExp(
          `"just",\\s*\\[\\s*"${recipe}"|\\bjust ${recipe}(?![\\w-])`,
        );
        return !specs.some((spec) => driven.test(spec));
      })
      .filter((recipe) => !(recipe in undrivenRecipes))
      .map(
        (recipe) =>
          `just ${recipe} is driven by no tooling spec and records no reason`,
      );
    const stale = Object.keys(undrivenRecipes)
      .filter((recipe) => !recipes.includes(recipe))
      .map((recipe) => `just ${recipe} no longer exists but records a reason`);
    expect([...findings, ...stale]).toEqual([]);
  });
});
