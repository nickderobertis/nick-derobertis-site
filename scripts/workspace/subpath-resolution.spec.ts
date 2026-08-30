import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { rspack, type Stats } from "@rspack/core";
import { remoteConfig } from "@site/build-config";
import { remoteRegistry } from "@site/build-config/remote-registry";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { overlappingSpecifiers } from "./published-subpaths";

/**
 * A specifier that begins with a shorter one this workspace also publishes —
 * `@site/build-config/remote-registry` against `@site/build-config` — has to
 * answer with its own target rather than with the shorter one's. Nothing else
 * checks that. Resolution here used to run through a map of Vite object
 * aliases, which match by prefix and so claim the whole path below each key,
 * and which of two overlapping keys won was decided by the order they happened
 * to be written in; a map that resolved could stop resolving the day somebody
 * sorted it. That map is gone and every project's own package manifest carries
 * resolution now, whose `exports` map is keyed by exact subpath. This is what
 * holds the workspace to that, so a return to prefix matching fails here.
 *
 * Two resolvers have to agree and they are configured separately, so agreement
 * in one says nothing about the other. Both halves below are real runs of the
 * thing that resolves — nothing here asks a resolver a question the pipeline
 * around it might answer differently:
 *
 * - the production build's, driven as a real rspack build of the very
 *   configuration `remoteConfig` hands every app's `rspack.config.ts`, over an
 *   entry that imports the subpath specifiers for real. What the build produced
 *   is what is read back: the module graph's answer for each specifier, and the
 *   bytes of the chunk it emitted;
 * - the test runner's, which is Vite's, configured by the shared harness every
 *   app and library states its test configuration through. That one cannot be
 *   answered from this process — these tooling specs run under a hand-written
 *   node config rather than under that harness — so it is driven as a real
 *   Vitest run over the probe beside this file.
 *
 * Both halves take their subjects from `./published-subpaths.ts`, the one
 * derivation over the manifests that publish them, so a subpath added tomorrow
 * is covered the day it is added and neither half can drift into asking about
 * a different set of them than the other. Between them every
 * published subpath is resolved for real: the test runner imports all of them,
 * and the build imports the ones a browser bundle can hold, which is every
 * subpath a build ever asks for.
 */

/**
 * Whether a target's source text contains no quoted `node:` specifier. That
 * substring is all this reads, and it is what the build half selects its
 * subjects by: rspack polyfills no Node builtin, so a module that reaches one
 * is never bundled and no production build ever asks for it. The reading is
 * deliberately loose in the safe direction — it matches a `node:` string that
 * is not an import and misses one a target reaches indirectly — because a
 * target it excludes is one the test-runner half below still resolves for
 * real, and between the two halves every published subpath is covered.
 */
function mentionsNoNodeBuiltin(target: string) {
  return !/["']node:/.test(readFileSync(target, "utf8"));
}

/**
 * The remote whose production build resolves these specifiers. Every remote is
 * configured by the same `remoteConfig` call, so one of them answers for all;
 * it is taken from the registry rather than named here so a renamed remote
 * cannot leave this building a project that no longer exists.
 */
function aRemoteUnderBuild(): string {
  const [name] = Object.keys(remoteRegistry).sort();
  if (name === undefined)
    throw new Error(
      "libs/build-config/src/remotes.json declares no remote, so there is no production build for this contract to resolve through. Run just generate-remote-registry and commit the result, then rerun just check.",
    );
  return name;
}

const remoteUnderBuild = aRemoteUnderBuild();
const subjects = overlappingSpecifiers();
const builtSubjects = subjects.filter((subject) =>
  mentionsNoNodeBuiltin(subject.target),
);

const buildRoot = resolve("dist/tooling-workspace/subpath-build");
// Beside the app's own `main`, so the build under test is still the whole one.
const probeEntry = "subpathProbe";

/**
 * A module that imports each specifier for real. Every namespace is assigned
 * somewhere the bundler cannot see through, so nothing it pulled in is dropped
 * again before the chunk is emitted.
 */
function entryImporting(specifiers: readonly string[]): string {
  return [
    ...specifiers.map(
      (specifier, index) =>
        `import * as subject${index} from ${JSON.stringify(specifier)};`,
    ),
    `globalThis.subpathProbe = [${specifiers.map((_, index) => `subject${index}`).join(", ")}];`,
    "",
  ].join("\n");
}

/**
 * The fields this contract reads out of a build's own stats. `toJson` hands
 * back rspack's serialization of its compilation rather than a value produced
 * here, and what it carries is set by the bundler's version rather than by this
 * file, so it is narrowed at that boundary rather than trusted because a
 * declaration says what it holds. Everything outside this schema is dropped.
 */
const reportSchema = z.object({
  errors: z.array(z.object({ message: z.string() })).optional(),
  assets: z
    .array(
      z.object({
        name: z.string(),
        chunkNames: z.array(z.string()).nullish(),
      }),
    )
    .optional(),
  modules: z
    .array(
      z.object({
        nameForCondition: z.string().nullish(),
        reasons: z
          .array(z.object({ userRequest: z.string().nullish() }))
          .nullish(),
      }),
    )
    .optional(),
});

type Report = z.infer<typeof reportSchema>;

/** What one real build produced, read back from its own output. */
type Build = {
  errors: string[];
  /** Every file the build answered a given request with. */
  answers: Map<string, Set<string>>;
  /** The bytes of the chunk emitted for the entry that did the importing. */
  emitted: string;
};

/**
 * Runs the production build of `remoteUnderBuild` — the configuration that
 * app's `rspack.config.ts` exports, unchanged except for the entry that does
 * the importing and an output directory of this lane's own — and reads its
 * result back. `@nx/rspack`'s app plugin takes the app it is configuring from
 * the task environment Nx sets around a build, so the build task is stood in
 * for here rather than the plugin stubbed out.
 */
async function build(
  lane: string,
  specifiers: readonly string[],
): Promise<Build> {
  const laneRoot = resolve(buildRoot, lane);
  rmSync(laneRoot, { recursive: true, force: true });
  mkdirSync(laneRoot, { recursive: true });
  const entry = resolve(laneRoot, "entry.js");
  writeFileSync(entry, entryImporting(specifiers));
  const outputPath = resolve(laneRoot, "out");
  process.env.NX_TASK_TARGET_PROJECT = remoteUnderBuild;
  process.env.NX_TASK_TARGET_TARGET = "build";
  const production = remoteConfig(remoteUnderBuild);
  const compiler = rspack({
    ...production,
    entry: { main: production.entry, [probeEntry]: entry },
    output: { ...production.output, path: outputPath },
  });
  const stats = await new Promise<Stats>((done, fail) => {
    compiler.run((failure, produced) => {
      if (failure) fail(failure);
      else if (produced === undefined)
        fail(new Error(`the ${remoteUnderBuild} build produced no stats`));
      else done(produced);
    });
  });
  const printed: unknown = stats.toJson({
    all: false,
    errors: true,
    assets: true,
    modules: true,
    reasons: true,
  });
  const read = reportSchema.safeParse(printed);
  if (!read.success)
    throw new Error(
      `the ${remoteUnderBuild} build reported stats this contract cannot read, so nothing it says about resolution can be trusted:\n${z.prettifyError(read.error)}`,
    );
  const report = read.data;
  await new Promise<void>((done) => compiler.close(() => done()));
  return {
    errors: (report.errors ?? []).map((error) => error.message),
    answers: answersIn(report),
    emitted: emittedFor(report, outputPath),
  };
}

/**
 * What the build's own module graph says each request resolved to. A request
 * appears once per module that made it, and every one of them has to have been
 * answered with the same file, so the answers are collected as a set.
 */
function answersIn(report: Report): Map<string, Set<string>> {
  const answers = new Map<string, Set<string>>();
  for (const module of report.modules ?? []) {
    const answer = module.nameForCondition;
    if (!answer) continue;
    for (const reason of module.reasons ?? []) {
      const request = reason.userRequest;
      if (!request) continue;
      const answered = answers.get(request) ?? new Set<string>();
      answered.add(answer);
      answers.set(request, answered);
    }
  }
  return answers;
}

/**
 * The bytes of the JavaScript chunk the build emitted for the importing entry.
 * A build that reported no error can still have emitted nothing for it, so the
 * asset is located through the stats rather than guessed at from the directory.
 */
function emittedFor(report: Report, outputPath: string): string {
  const asset = (report.assets ?? []).find(
    (candidate) =>
      candidate.name.endsWith(".js") &&
      (candidate.chunkNames ?? []).includes(probeEntry),
  );
  if (asset === undefined) return "";
  return readFileSync(resolve(outputPath, asset.name), "utf8");
}

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (typeof value === "object" && value !== null)
    return Object.entries(value).flatMap(([key, member]) => [
      key,
      ...stringsIn(member),
    ]);
  return [];
}

let built: Build;

beforeAll(async () => {
  built = await build(
    "published",
    builtSubjects.map((subject) => subject.specifier),
  );
});

afterAll(() => {
  delete process.env.NX_TASK_TARGET_PROJECT;
  delete process.env.NX_TASK_TARGET_TARGET;
  rmSync(buildRoot, { recursive: true, force: true });
});

describe("the production build resolves published subpaths", () => {
  it("builds an import of every published subpath a bundle can hold", () => {
    expect(
      builtSubjects.length,
      "no @site package publishes a subpath beside its bare specifier that a browser bundle can hold, so this build imported nothing; confirm the workspace still publishes the subpath exports this contract reads",
    ).toBeGreaterThan(0);
    expect(built.errors).toEqual([]);
  });

  it("answers every longer specifier with its own target, not the shorter one's", () => {
    const findings = builtSubjects.flatMap((subject) => {
      const answered = [...(built.answers.get(subject.specifier) ?? [])];
      const target = resolve(subject.target);
      if (answered.length === 1 && answered[0] === target) return [];
      return [
        `the ${remoteUnderBuild} build resolved ${subject.specifier} to ${answered.join(", ") || "no module"}, not to ${target}, which its package publishes for it${answered.includes(resolve(subject.shorterTarget)) ? ` — it was answered by ${subject.shorter} itself` : ""}; give rspack a resolution that reads the package's exports map rather than matching specifiers by prefix`,
      ];
    });
    expect(findings).toEqual([]);
  });

  it("carries each JSON subpath's own content into the chunk it emitted", () => {
    // The module graph above says what was resolved; this says what was built
    // from it. A JSON target's own strings survive into the emitted bytes
    // verbatim, where a TypeScript target's are minified away, so those are the
    // subjects whose content can be read back out of the artifact.
    const findings = builtSubjects
      .filter((subject) => subject.target.endsWith(".json"))
      .flatMap((subject) => {
        const missing = stringsIn(
          JSON.parse(readFileSync(subject.target, "utf8")),
        ).filter((content) => !built.emitted.includes(content));
        return missing.length === 0
          ? []
          : [
              `the chunk the ${remoteUnderBuild} build emitted for ${subject.specifier} is missing ${missing.join(", ")}, which ${subject.target} is built from; the build resolved that specifier somewhere other than the file its package publishes for it`,
            ];
      });
    expect(findings).toEqual([]);
  });

  it("refuses a subpath no package publishes", async () => {
    // Every subject above resolves, so the assertions they satisfy are also the
    // ones a build that answered every request with the same file would
    // satisfy. This is the same build held to a subpath outside the exports
    // map, which a resolution matching by prefix would answer rather than
    // refuse.
    const [subject] = builtSubjects;
    if (subject === undefined)
      throw new Error(
        "no @site package publishes a subpath a browser bundle can hold, so there is no package to ask for one it does not publish. Confirm the workspace still publishes the subpath exports this contract reads, then rerun just check.",
      );
    const subpath = "./published-by-nothing";
    const unpublished = `${subject.shorter}${subpath.slice(1)}`;
    const refused = await build("unpublished", [unpublished]);
    // The refusal names the exports map it consulted, which is the mechanism
    // this whole contract rests on rather than an incidental detail of it.
    expect(refused.errors.join("\n")).toContain(
      `Package subpath '${subpath}' is not defined by "exports"`,
    );
    expect(refused.answers.get(unpublished)).toBeUndefined();
  });
});

/**
 * Everything a failed run printed. What `execFile` rejects with carries the
 * subprocess output on it, but it is an arbitrary rejection value rather than
 * something this file produced, so it is read for those two fields rather than
 * asserted to have them.
 */
function printedBy(error: unknown): string {
  const printed = z
    .object({ stdout: z.string().optional(), stderr: z.string().optional() })
    .safeParse(error);
  return printed.success
    ? `${printed.data.stdout ?? ""}${printed.data.stderr ?? ""}`
    : String(error);
}

/**
 * The probe's config and its twin, which states the same `remotes` map in the
 * opposite order and differs in nothing else. That map is the last ordered map
 * a resolution here still depends on: the `paths` map whose key order used to
 * decide which of two overlapping aliases won is gone, and an `exports` map is
 * keyed by exact subpath rather than ordered. Running the probe under both is
 * what says every answer it reads is the same one either way round, so no
 * resolution below can be broken by somebody sorting a map.
 */
const probeConfigs = [
  "scripts/workspace/subpath-resolution-probe/vite.config.ts",
  "scripts/workspace/subpath-resolution-probe/vite.config.reversed.ts",
];

describe("the workspace test runner resolves published subpaths", () => {
  it.each(probeConfigs)(
    "answers every longer specifier the same way under the shared test harness configured by %s",
    async (probeConfig) => {
      // The probe states the same contract against Vite's resolver, under a
      // config the shared harness produced. Its own diagnostics are the report,
      // so everything it printed is carried into the failure here.
      // llmlint: ignore-block[work_goes_through_command_surface] No documented recipe reaches this run and none should: the probe belongs to no Nx project, so no `test` target selects it, and what this case needs is one Vitest run per component config so that one subject is answered under each order of the `remotes` map. That pair is the contract itself, not a step a recipe wraps. The recipe surface still owns the work: `just test` dispatches `tooling-workspace:test`, which runs this file, and this subprocess is the subject it drives.
      const run = await promisify(execFile)(
        "pnpm",
        ["exec", "vitest", "run", "--config", probeConfig],
        { encoding: "utf8" },
      ).catch((error: unknown) => {
        throw new Error(
          `${probeConfig} reported a resolution the shared test harness does not answer as its package publishes it:\n${printedBy(error)}`,
        );
      });
      // llmlint: ignore-end[work_goes_through_command_surface]
      expect(`${run.stdout}${run.stderr}`).toContain("Test Files");
    },
  );
});
