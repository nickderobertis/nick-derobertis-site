import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it, onTestFinished } from "vitest";
import { z } from "zod";

/**
 * What a cached green is a statement about.
 *
 * Nx replays a target's last result whenever every file in that target's key is
 * unchanged, so the key decides which changes a pass has actually been checked
 * against. A key that names a file the command never reads bills the whole
 * workspace for a change that reached nothing; a key that omits a file the
 * command does read reports green for bytes no run ever saw, which is the worse
 * failure because it is silent.
 *
 * Both edges live here. `biome.json` is read by `lint` alone, so it may not key
 * `build`, `test`, or `typecheck` anywhere. `apps/shell` owns the workspace's
 * only eslint run — `eslint .` over the whole tree — so its `lint` key has to
 * cover its own configuration, every file that command lints, and the
 * `project.json` tags `@nx/enforce-module-boundaries` resolves out of the
 * project graph.
 *
 * Each claim is read from the graph Nx resolves rather than from a list kept
 * here, so a project added tomorrow is covered the day it is added, and each is
 * then confirmed against `nx show target inputs`, which is Nx's own answer to
 * "is this file in this target's key".
 */

/** Read as a fileset, this is what `biome lint` loads and nothing else does. */
const biomeConfig = "{workspaceRoot}/biome.json";

/** Targets whose commands — rspack, Vitest, tsc — read no Biome configuration. */
const readNoBiomeConfig = ["build", "test", "typecheck"];

/**
 * Targets that compose the served artifact or drive a browser against it.
 * Replaying one would report a pass over bytes it never served.
 */
const composeOrDriveTheArtifact = ["e2e", "prerender", "screenshot", "perf"];

// Project roots reach path assertions below, and both project and target names
// go back to Nx as `project:target` arguments, so each is narrowed where the
// graph is read rather than trusted because Nx printed it. Files that arrive
// from git are held to the same rule: they are read as cache-key evidence and
// handed back to Nx as changed paths.
const projectName = z.string().regex(/^[a-z][a-z0-9-]*$/);
const targetName = z.string().regex(/^[a-z][a-z0-9-]*$/);
const namedInputName = z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]*$/);
const workspacePath = z.string().regex(/^[\w.-]+(?:\/[\w.-]+)*$/);
const workspaceDirectory = z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/);

/**
 * Every form an Nx input takes, spelled out rather than left open. A name and a
 * `fileset` are the two that name workspace files, which is what `keyedOn`
 * measures; the rest key a target on something no file change moves — a runtime
 * command's output, an environment variable, a package version, another task's
 * output — and so contribute no fileset by design. A form outside this union is
 * refused here, because parsing it as an object with nothing recognized in it
 * would drop whatever files it names and read as a target not keyed on them.
 */
const inputSchema = z.union([
  z.string(),
  z.object({ fileset: z.string() }),
  z.object({
    input: z.string(),
    projects: z.union([z.string(), z.array(z.string())]).optional(),
    dependencies: z.boolean().optional(),
  }),
  z.object({
    dependentTasksOutputFiles: z.string(),
    transitive: z.boolean().optional(),
  }),
  z.object({ runtime: z.string() }),
  z.object({ env: z.string() }),
  z.object({ externalDependencies: z.array(z.string()) }),
]);

const targetSchema = z.object({
  cache: z.boolean().optional(),
  inputs: z.array(inputSchema).optional(),
  options: z.object({ command: z.string().optional() }).optional(),
});

const graphSchema = z.object({
  graph: z.object({
    nodes: z.record(
      projectName,
      z.object({
        data: z.object({
          root: workspaceDirectory,
          targets: z.record(targetName, targetSchema).optional(),
        }),
      }),
    ),
  }),
});

const nxJsonSchema = z.object({
  namedInputs: z.record(namedInputName, z.array(inputSchema)).optional(),
});

type Input = z.infer<typeof inputSchema>;
type Target = z.infer<typeof targetSchema>;
type Project = { name: string; root: string; targets: Record<string, Target> };

let projects: Project[] = [];
let namedInputs: Record<string, Input[]> = {};

beforeAll(() => {
  const graphFile = join(
    mkdtempSync(join(tmpdir(), "cache-keying-")),
    "graph.json",
  );
  execFileSync("pnpm", ["exec", "nx", "graph", `--file=${graphFile}`], {
    encoding: "utf8",
    stdio: "pipe",
  });
  const graph = graphSchema.parse(JSON.parse(readFileSync(graphFile, "utf8")));
  projects = Object.entries(graph.graph.nodes).map(([name, node]) => ({
    name,
    root: node.data.root,
    targets: node.data.targets ?? {},
  }));
  namedInputs =
    nxJsonSchema.parse(JSON.parse(readFileSync("nx.json", "utf8")))
      .namedInputs ?? {};
});

/** Nx's own key when a target declares no inputs of its own. */
const declaredInputs = (target: Target) =>
  target.inputs ?? ["default", "^default"];

/**
 * The filesets a target is keyed on, with every named input resolved the way Nx
 * resolves it. A name is expanded once: repeats add no fileset, and the visited
 * set is what keeps a named input that refers to itself from recurring forever.
 */
function keyedOn(inputs: Input[], expanded = new Set<string>()): string[] {
  const filesets: string[] = [];
  for (const input of inputs) {
    const named =
      typeof input === "string"
        ? input
        : "input" in input
          ? input.input
          : undefined;
    const name = named?.startsWith("^") ? named.slice(1) : named;
    const definition = name === undefined ? undefined : namedInputs[name];
    if (name !== undefined && definition) {
      if (expanded.has(name)) continue;
      expanded.add(name);
      filesets.push(...keyedOn(definition, expanded));
    } else if (typeof input === "string") filesets.push(input);
    else if ("fileset" in input) filesets.push(input.fileset);
  }
  return filesets;
}

const targetsOf = (project: Project) =>
  Object.entries(project.targets).map(([name, target]) => ({
    task: `${project.name}:${name}`,
    name,
    target,
  }));

const allTargets = () => projects.flatMap(targetsOf);

/**
 * Nx colors the sentence it prints under a task runner and leaves it plain in a
 * terminal, and the escapes land mid-sentence, around the file and the task.
 * Built from the escape character rather than written as a literal, so this
 * pattern carries no control character of its own.
 */
const ansiEscape = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/**
 * Nx's own answer for one task, which is what the readings above are confirmed
 * against. The CLI reports a missing input by exiting non-zero, so the two
 * answers are told apart by what it printed, never by its status alone.
 */
function nxKeysTaskOn(task: string, file: string): boolean {
  const result = spawnSync(
    "pnpm",
    ["exec", "nx", "show", "target", "inputs", task, "--check", file],
    { encoding: "utf8" },
  );
  const printed = (result.stdout ?? "").replace(ansiEscape, "");
  if (printed.includes(`${file} is not an input for ${task}`)) return false;
  if (printed.includes(`${file} is an input for ${task}`)) return true;
  throw new Error(
    `nx show target inputs ${task} --check ${file} answered neither: ${printed}${result.stderr ?? ""}`,
  );
}

function nxInputFiles(task: string): string[] {
  const printed = execFileSync(
    "pnpm",
    ["exec", "nx", "show", "target", "inputs", task, "--json"],
    { encoding: "utf8" },
  );
  return z.object({ files: z.array(workspacePath) }).parse(JSON.parse(printed))
    .files;
}

/**
 * The projects Nx would select for a target if only these files had changed,
 * which is the half of the question `nx show target inputs` cannot answer: a
 * key that covers a file still checks nothing if the change never selects it.
 */
function selectedFor(target: string, ...files: string[]): string[] {
  const printed = execFileSync(
    "pnpm",
    [
      "exec",
      "nx",
      "show",
      "projects",
      "--affected",
      `--files=${files.join(",")}`,
      `--with-target=${target}`,
      "--json",
    ],
    { encoding: "utf8" },
  );
  return projectName.array().parse(JSON.parse(printed));
}

// Every claim below is read out of the parsed graph, so what the parse accepts
// decides what those claims can see. An input form it lets through without
// understanding contributes no fileset, and a target keyed on a file then reads
// as a target not keyed on it — a green that means nothing, quietly.
describe("the graph reading refuses configuration it cannot measure", () => {
  const graphKeyedOn = (input: unknown) => ({
    graph: {
      nodes: {
        awards: {
          data: {
            root: "apps/awards",
            targets: { lint: { cache: true, inputs: [input] } },
          },
        },
      },
    },
  });

  it.each([
    ["a named input", "default"],
    ["a fileset", { fileset: "{workspaceRoot}/biome.json" }],
    ["a named input resolved elsewhere", { input: "production" }],
    [
      "another task's outputs",
      { dependentTasksOutputFiles: "**/*.d.ts", transitive: true },
    ],
    ["a runtime command", { runtime: "node --version" }],
    ["an environment variable", { env: "CI" }],
    ["an external dependency", { externalDependencies: ["playwright"] }],
  ])("reads a target keyed on %s", (_, input) => {
    expect(() => graphSchema.parse(graphKeyedOn(input))).not.toThrow();
  });

  it.each([
    ["names nothing at all", {}],
    ["names files in a form Nx grew later", { workspaceFiles: "**/*.ts" }],
  ])("refuses a target whose input %s", (_, input) => {
    expect(() => graphSchema.parse(graphKeyedOn(input))).toThrow();
  });
});

describe("the Biome configuration keys only the target that reads it", () => {
  it("keys no project's build, test, or typecheck on biome.json", () => {
    const overkeyed = projects
      .flatMap(targetsOf)
      .filter(({ name }) => readNoBiomeConfig.includes(name))
      .filter(({ target }) =>
        keyedOn(declaredInputs(target)).includes(biomeConfig),
      )
      .map(
        ({ task }) =>
          `${task} is keyed on biome.json, which only lint reads, so a Biome rule change reruns it for nothing`,
      );
    expect(overkeyed).toEqual([]);
  });

  it("still keys every target that runs Biome on biome.json", () => {
    const linters = allTargets().filter(({ target }) =>
      /\bbiome\b/.test(target.options?.command ?? ""),
    );
    // Dropping the input everywhere would satisfy the rule above and leave
    // every Biome run replaying a green from before the rule changed.
    expect(linters.length).toBeGreaterThan(0);
    const unkeyed = linters
      .filter(
        ({ target }) => !keyedOn(declaredInputs(target)).includes(biomeConfig),
      )
      .map(
        ({ task }) =>
          `${task} runs Biome but is not keyed on biome.json, so a rule change replays its last result`,
      );
    expect(unkeyed).toEqual([]);
  });

  it("resolves those keys that way in Nx too", () => {
    // The readings above are of declared configuration; Nx resolving it is what
    // decides a replay. One project per shape is confirmed against Nx itself,
    // so an app, a library, and a tooling project are each covered without
    // naming any of them here, and the graph reading is held to Nx's answer.
    const shapes = ["apps/", "libs/", "scripts/"].flatMap((prefix) =>
      projects
        .filter((project) => project.root.startsWith(prefix))
        .sort((one, other) => one.name.localeCompare(other.name))
        .slice(0, 1),
    );
    expect(shapes).toHaveLength(3);

    const miskeyed = shapes
      .flatMap(targetsOf)
      .filter(({ name }) => [...readNoBiomeConfig, "lint"].includes(name))
      .map(({ task, target }) => ({
        task,
        runsBiome: /\bbiome\b/.test(target.options?.command ?? ""),
        keyed: nxKeysTaskOn(task, "biome.json"),
      }))
      .filter(({ runsBiome, keyed }) => runsBiome !== keyed)
      .map(({ task, keyed }) =>
        keyed
          ? `Nx keys ${task} on biome.json, which that task's command never reads`
          : `Nx does not key ${task} on biome.json, though its command runs Biome`,
      );
    expect(miskeyed).toEqual([]);
  }, 60_000);
});

describe("the workspace eslint run is keyed on everything it reads", () => {
  it("keys apps/shell's lint on its configuration and every file it lints", () => {
    const keyed = new Set(nxInputFiles("shell:lint"));

    expect(keyed.has("eslint.config.mjs")).toBe(true);

    // eslint . reads the whole tree, so every tracked file it would lint has to
    // be in the key, along with the project.json tags the boundary rule reads.
    const readByEslint = workspacePath
      .array()
      .parse(
        execFileSync(
          "git",
          [
            "ls-files",
            "*.ts",
            "*.tsx",
            "*.js",
            "*.jsx",
            "*.mjs",
            "*.cjs",
            "*/project.json",
          ],
          { encoding: "utf8" },
        )
          .split("\n")
          .filter(Boolean),
      );
    expect(readByEslint.length).toBeGreaterThan(0);
    expect(readByEslint.filter((file) => !keyed.has(file))).toEqual([]);
  }, 60_000);

  it("selects that lint when only the eslint configuration changes", () => {
    // Named by no input, eslint.config.mjs used to select nothing at all: a
    // rule change ran no lint task and the gate reported green without it.
    expect(selectedFor("lint", "eslint.config.mjs")).toContain("shell");
  }, 60_000);

  it("selects that lint when another project's source changes", () => {
    // Any app but the shell makes the point, so the one taken here comes from
    // the graph: the boundary rules are enforced from the shell's target, and a
    // change the shell is not selected for is a change eslint never reads.
    const other = projects.find(
      (project) => project.root.startsWith("apps/") && project.name !== "shell",
    );
    if (!other) throw new Error("the workspace has no app besides the shell");
    const [source] = workspacePath.array().parse(
      execFileSync("git", ["ls-files", `${other.root}/src/*.tsx`], {
        encoding: "utf8",
      })
        .split("\n")
        .filter(Boolean),
    );
    expect(source).toBeDefined();

    expect(selectedFor("lint", source ?? "")).toEqual(
      expect.arrayContaining([other.name, "shell"]),
    );
  }, 60_000);
});

/**
 * The keys above are declarations. What a developer and CI actually pay is
 * whether Nx runs a task or replays it, so the two claims that motivate this
 * change are also made against a real run: the same edit that has to rerun the
 * command reading it has to leave every other command replaying.
 */

/**
 * Nx's per-task notes for a result it replayed instead of running the command.
 * Which one it prints says only where the outputs had to come from — still on
 * disk, the local cache, or a remote one — and one run prints more than one of
 * them across a set of tasks, so all three read the same way here: the command
 * did not run.
 */
const replayedNotes = [
  "[existing outputs match the cache, left as is]",
  "[local cache]",
  "[remote cache]",
];

/**
 * A cache directory the calling test owns, empty until that test fills it.
 *
 * Nx keeps a cached result in two places: the outputs under
 * `NX_CACHE_DIRECTORY`, and the record naming them in the database under
 * `NX_WORKSPACE_DATA_DIRECTORY`. Moving only the first leaves the record
 * behind, and Nx answers from it for outputs still sitting in the tree, so both
 * have to move for a run to start from nothing. Nx's daemon lives in that same
 * data directory, so these runs go without it rather than start one for a
 * directory that is about to be discarded.
 */
function ownCacheDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "cache-keying-nx-"));
  onTestFinished(() => rmSync(directory, { force: true, recursive: true }));
  return directory;
}

const probedTargets = ["typecheck", "test", "build", "lint"];

/**
 * The project the Biome experiment runs on: the first library, by name, that
 * declares all four probed targets. Read from the graph rather than named, so
 * it stays a real project as the workspace changes.
 */
function probeProject(): string {
  const [probe] = projects
    .filter((project) => project.root.startsWith("libs/"))
    .filter((project) =>
      probedTargets.every((target) => target in project.targets),
    )
    .sort((one, other) => one.name.localeCompare(other.name));
  if (!probe)
    throw new Error(
      `no library declares all of ${probedTargets.join(", ")}, so the cache experiment has nothing to run on`,
    );
  return probe.name;
}

/**
 * Under GitHub Actions, Nx folds each task's output into a collapsible group,
 * which puts a marker and a status icon in front of the per-task line read
 * below. `NX_SKIP_LOG_GROUPING` turns that off for these runs, and the marker
 * is stripped here as well, so what this reads is the same line on a runner and
 * on a contributor's machine whichever way that switch goes.
 */
const groupMarker = /^::(?:end)?group::\S*\s*/;

/**
 * Whether Nx ran each task or replayed it, against the cache directory the
 * calling test owns. Nx reports one line per task, so the outcome is read from
 * the run rather than inferred, and a target the run never mentions is an error
 * instead of a silently absent assertion.
 */
function outcomesOf(
  project: string,
  targets: string[],
  cacheDirectory: string,
) {
  // llmlint: ignore-block[work_goes_through_command_surface] The Nx dispatch is the subject here, not the means: this reads whether Nx ran or replayed one named task, which requires this exact invocation — one project, one task at a time, and the static reporter that prints a per-task outcome. Every `just` recipe that dispatches targets does so for the whole affected set and reports a pass or a failure rather than a cache outcome, and this spec runs inside one of them, so routing through the surface would both hide the signal and recurse.
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "nx",
      "run-many",
      "-t",
      targets.join(","),
      `--projects=${project}`,
      "--parallel=1",
      "--output-style=static",
    ],
    {
      encoding: "utf8",
      env: {
        // llmlint: ignore[boundary_inputs_validated] The inherited environment is forwarded, never read: `pnpm exec nx` needs the caller's PATH, HOME, and Node resolution to start at all, and nothing here parses, branches on, or interpolates any of it. The four values this run's answer depends on are set below it, from directories the test itself created, so they override whatever was inherited.
        ...process.env,
        NX_CACHE_DIRECTORY: join(cacheDirectory, "cache"),
        NX_DAEMON: "false",
        NX_SKIP_LOG_GROUPING: "true",
        NX_WORKSPACE_DATA_DIRECTORY: join(cacheDirectory, "data"),
      },
    },
  );
  const printed = `${result.stdout ?? ""}${result.stderr ?? ""}`.replace(
    ansiEscape,
    "",
  );
  if (result.status !== 0)
    throw new Error(
      `nx run-many -t ${targets.join(",")} --projects=${project} failed: ${printed}`,
    );
  // llmlint: ignore-end[work_goes_through_command_surface]
  const outcomes = new Map<string, "replayed" | "ran">();
  for (const line of printed.split("\n")) {
    const reported = line.trim().replace(groupMarker, "");
    const task = /^> nx run (\S+:\S+)/.exec(reported)?.[1];
    if (task !== undefined)
      outcomes.set(
        task,
        replayedNotes.some((note) => reported.includes(note))
          ? "replayed"
          : "ran",
      );
  }
  const unreported = targets.filter(
    (target) => !outcomes.has(`${project}:${target}`),
  );
  if (unreported.length > 0)
    throw new Error(
      `nx reported no outcome for ${unreported.map((target) => `${project}:${target}`).join(", ")}: ${printed}`,
    );
  return outcomes;
}

/**
 * An edit that changes the bytes Nx hashes and nothing about what a tool does
 * with them, restored before the test that made it returns. That inertness is
 * what makes an outcome attributable to the key rather than to a new
 * diagnostic, so it is verified against Biome here rather than assumed: an edit
 * that stops being inert fails at this line instead of surfacing as a
 * formatting failure somewhere else in the gate.
 */
function withInertEdit<T>(
  file: string,
  mutate: (original: string) => string,
  body: () => T,
): T {
  // Both the bytes on disk and the mutator's answer are narrowed before either
  // is written back: a rule file that has become empty, and a probe that
  // returned the text it was given, both read downstream as "Nx replayed
  // everything" — the shape of a passing result, arrived at without a probe.
  const configuration = z.string().min(1);
  const original = configuration.parse(readFileSync(file, "utf8"));
  const probed = configuration.parse(mutate(original));
  if (probed === original)
    throw new Error(
      `the probe edit to ${file} changed nothing, so it keys nothing and no target could rerun for it`,
    );
  try {
    writeFileSync(file, probed);
    // llmlint: ignore-block[work_goes_through_command_surface] This asks Biome about one file, the scratch edit just written, while the tree is deliberately in a state no gate should see. `just lint` and `just check` answer for the whole tree and would fail here for everything except the question being asked; there is no recipe that formats-checks a single path, and adding one would exist only for this line.
    const checked = spawnSync(
      "pnpm",
      ["exec", "biome", "check", "--error-on-warnings", file],
      { encoding: "utf8" },
    );
    // llmlint: ignore-end[work_goes_through_command_surface]
    if (checked.status !== 0)
      throw new Error(
        `the probe edit to ${file} is not inert: ${checked.stdout ?? ""}${checked.stderr ?? ""}`,
      );
    return body();
  } finally {
    writeFileSync(file, original);
  }
}

/**
 * A token this run has never used. Without one the probes below would be
 * self-defeating: the second time a given edit is made, Nx has already cached
 * the task it should rerun under exactly that edit's hash, and would replay it.
 * Only the key's novelty is load-bearing, so nothing reads the token back.
 */
const probeToken = () => randomUUID();

/**
 * One more exclusion, naming a path the workspace does not have. It goes last,
 * where a negation changes the outcome for nothing the earlier patterns already
 * matched, and where Biome's own ordering for this list leaves it alone.
 */
function oneMoreExclusion(original: string): string {
  const list = /("includes"\s*:\s*\[\n)([\s\S]*?)(\n(\s*)\])/.exec(original);
  const [matched, declaration, entries, closing, closingIndent] = list ?? [];
  if (!matched || !declaration || !entries || !closing || !closingIndent)
    throw new Error("biome.json declares no files.includes list to probe");
  const indent = /^\s+/.exec(entries)?.[0] ?? `${closingIndent}  `;
  return original.replace(
    matched,
    `${declaration}${entries},\n${indent}"!.cache-keying-probe-${probeToken()}"${closing}`,
  );
}

/** A comment, which changes no rule the configuration exports. */
const oneMoreComment = (original: string) =>
  `// A cache-keying probe's inert edit (${probeToken()}), restored before its test returns.\n${original}`;

describe("what a rule-file change actually costs when the gate runs", () => {
  it("replays build, test, and typecheck for a Biome change, and reruns lint", () => {
    const project = probeProject();
    const cacheDirectory = ownCacheDirectory();

    // This run is where the cache being measured comes from. It starts empty,
    // so every probed target has to run here — and that it did is asserted
    // rather than assumed, because a replay at this point would mean the run
    // read a cache from outside the test, and every outcome below would be
    // about that cache instead of the keys.
    const warmed = outcomesOf(project, probedTargets, cacheDirectory);
    expect(
      probedTargets.filter(
        (target) => warmed.get(`${project}:${target}`) !== "ran",
      ),
    ).toEqual([]);

    const outcomes = withInertEdit("biome.json", oneMoreExclusion, () =>
      outcomesOf(project, probedTargets, cacheDirectory),
    );

    expect(outcomes.get(`${project}:typecheck`)).toBe("replayed");
    expect(outcomes.get(`${project}:test`)).toBe("replayed");
    expect(outcomes.get(`${project}:build`)).toBe("replayed");
    // The same edit against the one command that reads it. Without this the
    // three above would also hold for a biome.json nothing is keyed on, which
    // would replay a Biome green from before the rule changed.
    expect(outcomes.get(`${project}:lint`)).toBe("ran");
  }, 300_000);

  it("reruns apps/shell's lint for an eslint configuration change", () => {
    const cacheDirectory = ownCacheDirectory();

    expect(
      outcomesOf("shell", ["lint"], cacheDirectory).get("shell:lint"),
    ).toBe("ran");
    // Nothing changed between these two runs, so the second has to replay. An
    // uncacheable lint target would satisfy the assertion below for free.
    expect(
      outcomesOf("shell", ["lint"], cacheDirectory).get("shell:lint"),
    ).toBe("replayed");

    const outcomes = withInertEdit("eslint.config.mjs", oneMoreComment, () =>
      outcomesOf("shell", ["lint"], cacheDirectory),
    );

    // Named by no input, this file used to key nothing: a rule change replayed
    // the pass that had never read it.
    expect(outcomes.get("shell:lint")).toBe("ran");
  }, 300_000);
});

/**
 * One recipe as `just` defines it. Anything `just` says about a recipe it
 * cannot show carries no `--skip-nx-cache` either, and would read here as a
 * gate that keeps its cache, so the answer counts only once it opens with the
 * requested recipe's own header.
 */
function recipeBody(recipe: string): string {
  return z
    .string()
    .refine(
      (body) => new RegExp(`(^|\\n)${recipe}(:| )`).test(body),
      `just --show ${recipe} must print that recipe's definition`,
    )
    .parse(execFileSync("just", ["--show", recipe], { encoding: "utf8" }));
}

describe("the gate keeps the cache it can replay", () => {
  it("discards no cached task in check or check-all", () => {
    const discarding = ["check", "check-all"]
      .filter((recipe) => recipeBody(recipe).includes("--skip-nx-cache"))
      .map(
        (recipe) =>
          `just ${recipe} passes --skip-nx-cache, which discards the cached builds under its e2e and screenshot targets`,
      );
    expect(discarding).toEqual([]);
  });

  it("declares the targets it cannot replay uncacheable", () => {
    const undeclared = allTargets()
      .filter(({ name }) => composeOrDriveTheArtifact.includes(name))
      .filter(({ target }) => target.cache !== false)
      .map(
        ({ task }) =>
          `${task} does not declare cache: false, so whether Nx replays it is left to be inferred`,
      );
    expect(undeclared).toEqual([]);
  });
});
