import { execFile } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { type Resolve, rspack } from "@rspack/core";
import { remoteConfig } from "@site/build-config";
import { remoteRegistry } from "@site/build-config/remote-registry";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";

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
 * in one says nothing about the other:
 *
 * - the production build's, which is rspack's, configured by the very
 *   `remoteConfig` every app's `rspack.config.ts` builds its compiler from;
 * - the test runner's, which is Vite's, configured by the shared harness every
 *   app and library states its test configuration through. That one cannot be
 *   answered from this process — these tooling specs run under a hand-written
 *   node config rather than under that harness — so it is driven as a real
 *   Vitest run over the probe beside this file.
 *
 * Both halves resolve real specifiers rather than reading configuration, and
 * both derive their subjects from the manifests that publish them, so a subpath
 * added tomorrow is covered the day it is added.
 */

const packageName = z.string().regex(/^@site\/[a-z][a-z0-9-]*$/);

// Both halves of an exports map are read here: a key is the subpath a
// specifier asks for, and a value is the file the answer has to be.
const manifestSchema = z.object({
  name: packageName,
  exports: z
    .record(
      z.string().regex(/^\.(?:\/[\w.-]+)*$/),
      z.string().regex(/^\.\/[\w.-]+(?:\/[\w.-]+)*$/),
    )
    .optional(),
});

/**
 * A subpath a package publishes beside the bare specifier it begins with. Both
 * are carried, because the finding is the longer one being answered with the
 * shorter one's target.
 */
type Overlap = {
  shorter: string;
  shorterTarget: string;
  specifier: string;
  target: string;
};

function overlappingSpecifiers(): Overlap[] {
  return ["apps", "libs", "scripts"].flatMap((tree) =>
    readdirSync(tree, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        const root = `${tree}/${entry.name}`;
        let document: string;
        try {
          document = readFileSync(`${root}/package.json`, "utf8");
        } catch {
          // A directory under a project tree with no manifest publishes
          // nothing; project-manifest.spec.ts is what holds every Nx project
          // to having one.
          return [];
        }
        const manifest = manifestSchema.parse(JSON.parse(document));
        const exported = manifest.exports ?? {};
        const bare = exported["."];
        if (bare === undefined) return [];
        return Object.entries(exported)
          .filter(([subpath]) => subpath !== ".")
          .map(([subpath, target]) => ({
            shorter: manifest.name,
            shorterTarget: `${root}/${bare.slice(2)}`,
            specifier: `${manifest.name}${subpath.slice(1)}`,
            target: `${root}/${target.slice(2)}`,
          }));
      }),
  );
}

/**
 * One such subpath, for the readings below that have to be held to an input
 * they should report rather than to the compliant workspace.
 */
function anOverlappingSpecifier(): Overlap {
  const [subject] = overlappingSpecifiers();
  if (subject === undefined)
    throw new Error(
      "no @site package publishes a subpath beside its bare specifier, so there is no overlapping specifier to hold this reading to. Confirm the workspace still publishes the subpath exports this contract reads, then rerun just check.",
    );
  return subject;
}

/**
 * The compiler an app's production build runs, built from the configuration
 * that build reads. `@nx/rspack`'s app plugin takes the app it is configuring
 * from the task environment Nx sets around a build, so the build task is stood
 * in for here rather than the plugin stubbed out. Every remote is configured by
 * the same call, so one of them answers for all; it is taken from the registry
 * rather than named here so a renamed remote cannot leave this reading a
 * project that no longer exists.
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

function productionCompiler() {
  process.env.NX_TASK_TARGET_PROJECT = remoteUnderBuild;
  process.env.NX_TASK_TARGET_TARGET = "build";
  return rspack(remoteConfig(remoteUnderBuild));
}

const compiler = productionCompiler();

afterAll(async () => {
  delete process.env.NX_TASK_TARGET_PROJECT;
  delete process.env.NX_TASK_TARGET_TARGET;
  await new Promise<void>((done) => compiler.close(() => done()));
});

/**
 * What a resolver holding these options answers a request with, asked from the
 * directory that compilation resolves from. `false` is rspack's answer for a
 * request it was told to ignore, and a request it cannot resolve at all
 * throws; both are folded into a reported answer rather than raised, so a
 * finding names the specifier that produced it.
 */
function answerFor(options: Resolve, specifier: string): string {
  const resolver = compiler.resolverFactory.get("normal", options);
  try {
    const answer = resolver.resolveSync(
      {},
      compiler.options.context ?? process.cwd(),
      specifier,
    );
    return answer === false ? "no module, because rspack ignores it" : answer;
  } catch (error) {
    return `no module: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** What the production build itself answers, under its own resolve options. */
const productionAnswer = (specifier: string) =>
  answerFor(compiler.options.resolve, specifier);

describe("the production build resolves published subpaths", () => {
  it("answers every longer specifier with its own target, not the shorter one's", () => {
    const subjects = overlappingSpecifiers();
    expect(
      subjects.length,
      "no @site package publishes a subpath beside its bare specifier, so no overlapping specifier was resolved; confirm the workspace still publishes the subpath exports this contract reads",
    ).toBeGreaterThan(0);
    const findings = subjects.flatMap((subject) => {
      const answer = productionAnswer(subject.specifier);
      return answer === resolve(subject.target)
        ? []
        : [
            `the ${remoteUnderBuild} build answers ${subject.specifier} with ${answer}, not ${resolve(subject.target)}, which its package publishes for it${answer === resolve(subject.shorterTarget) ? ` — it is being answered by ${subject.shorter} itself` : ""}; give rspack a resolution that reads the package's exports map rather than matching specifiers by prefix`,
          ];
    });
    expect(findings).toEqual([]);
  });

  it("answers nothing for a subpath no package publishes", () => {
    // Every subject above resolves, so the assertion they satisfy is also the
    // one a resolver that answered every request with the same file would
    // satisfy. This is that reading held to a subpath outside the exports map.
    const subject = anOverlappingSpecifier();
    expect(productionAnswer(`${subject.shorter}/published-by-nothing`)).toMatch(
      /^no module/,
    );
  });

  it("reports a resolution that has stopped reading exports maps", () => {
    // The property above is carried by the manifests alone: no alias map backs
    // it up any more. So this is the same reading held to the one option that
    // would take the manifests back out of it, which is what a resolution
    // configured to match specifiers some other way would amount to.
    const subject = anOverlappingSpecifier();
    expect(
      answerFor(
        { ...compiler.options.resolve, exportsFields: [] },
        subject.specifier,
      ),
    ).not.toBe(resolve(subject.target));
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

describe("the workspace test runner resolves published subpaths", () => {
  const probeConfig =
    "scripts/workspace/subpath-resolution-probe/vite.config.ts";

  it("answers every longer specifier the same way under the shared test harness", async () => {
    // The probe states the same contract against Vite's resolver, under a
    // config the shared harness produced. Its own diagnostics are the report,
    // so everything it printed is carried into the failure here.
    const run = await promisify(execFile)(
      "pnpm",
      ["exec", "vitest", "run", "--config", probeConfig],
      { encoding: "utf8" },
    ).catch((error: unknown) => {
      throw new Error(
        `${probeConfig} reported a resolution the shared test harness does not answer as its package publishes it:\n${printedBy(error)}`,
      );
    });
    expect(`${run.stdout}${run.stderr}`).toContain("Test Files");
  });
});
