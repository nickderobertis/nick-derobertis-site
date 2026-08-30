import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * What the pre-push gate dispatches its browser and visual suites for.
 *
 * `e2e` is `cache: false`, and the shell owns the workspace's single `eslint .`
 * run, so Nx marks the shell affected for nearly any TypeScript change. The gate
 * used to run `nx affected -t e2e,screenshot` and then an unconditional `nx run
 * shell:e2e` on top of a `test` recipe that had already run an affected `e2e`
 * batch, so the heaviest suite in the repository was dispatched two or three
 * times per commit. Both halves of the property that replaced it are load
 * bearing and neither is visible to any other gate: the composed artifact's
 * suite has to run whenever a change reaches it, and it has to run when nothing
 * is affected at all, because affected selection must never be the only gate for
 * the composed artifact.
 *
 * So this drives the real command surface rather than reading the recipe. Each
 * scenario is a real commit built with git plumbing — no working tree is
 * touched — and `just gate-browser-lanes` resolves it through the real Nx
 * project graph before handing the affected selection to
 * `scripts/workspace/gate-browser-lanes.mjs`, which decides the lanes. `just check` itself is then run with its dispatcher recorded,
 * which is the only way to observe that one selection is dispatched once rather
 * than assumed to be, and the selection it dispatches is handed back to Nx for
 * the task graph it actually produces.
 */

const workspace = process.cwd();
const commitSha = z.string().regex(/^[0-9a-f]{40}$/);
const laneName = z.string().regex(/^[a-z][a-z0-9-]*$/);
const taskGraphSchema = z.object({
  tasks: z.object({ tasks: z.record(z.string(), z.unknown()) }),
});

/**
 * The identity every scenario commit below is authored and committed with.
 *
 * `git commit-tree` demands both, and a checkout has no reason to have
 * configured either: a CI runner's account carries no name to fall back on, so
 * a spec that inherited the machine's identity built its commits only where one
 * happened to exist and failed outright everywhere else. Supplying it here puts
 * it in the environment of this spec's own git calls and nowhere else — no
 * configuration is written, and every other command in this repository,
 * including the gate subprocesses below, still reads whatever identity it
 * would have read.
 */
const scenarioIdentity = {
  GIT_AUTHOR_NAME: "Gate browser lanes fixture",
  GIT_AUTHOR_EMAIL: "gate-browser-lanes@example.test",
  GIT_COMMITTER_NAME: "Gate browser lanes fixture",
  GIT_COMMITTER_EMAIL: "gate-browser-lanes@example.test",
};

let scratch: string;
let realPnpm: string;

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "gate-browser-lanes-"));
  realPnpm = execFileSync("bash", ["-c", "command -v pnpm"], {
    encoding: "utf8",
  }).trim();
  expect(realPnpm).not.toBe("");
});

/**
 * A real commit on top of `HEAD` carrying one edited file, built through git's
 * plumbing against a scratch index so the working tree and the checked-out
 * branch are never touched. Nx resolves `--base`/`--head` by diffing the two
 * commits, and an unreferenced commit object is as diffable as any other, which
 * is what makes a controlled affected selection cheap enough to assert on.
 */
function scenarioCommit(path: string, appended: string) {
  const index = join(scratch, `index-${path.replaceAll("/", "-")}`);
  const git = (args: string[]) =>
    execFileSync("git", args, {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, ...scenarioIdentity, GIT_INDEX_FILE: index },
    }).trim();
  const existing = git(["show", `HEAD:${path}`]);
  const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], {
    cwd: workspace,
    encoding: "utf8",
    input: `${existing}\n${appended}\n`,
  }).trim();
  git(["read-tree", "HEAD"]);
  git(["update-index", "--cacheinfo", `100644,${blob},${path}`]);
  const tree = git(["write-tree"]);
  const commit = commitSha.parse(
    git(["commit-tree", tree, "-p", "HEAD", "-m", `scenario: ${path}`]),
  );
  // Read back off the commit rather than trusted: a scenario authored from the
  // ambient identity instead of this spec's own would still be a commit Nx can
  // diff, so nothing downstream would notice, and the spec would go back to
  // being a function of the machine it runs on.
  expect(git(["show", "-s", "--format=%an <%ae>|%cn <%ce>", commit])).toBe(
    `${scenarioIdentity.GIT_AUTHOR_NAME} <${scenarioIdentity.GIT_AUTHOR_EMAIL}>` +
      `|${scenarioIdentity.GIT_COMMITTER_NAME} <${scenarioIdentity.GIT_COMMITTER_EMAIL}>`,
  );
  return commit;
}

/** The real recipe over a real push range, narrowed to the lanes it printed. */
function lanesFor(base: string, head: string) {
  const result = spawnSync("just", ["gate-browser-lanes", base, head], {
    cwd: workspace,
    encoding: "utf8",
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  const printed = result.stdout.trim();
  return z.array(laneName).parse(printed === "" ? [] : printed.split(","));
}

/**
 * Every work dispatch a gate recipe makes, in order.
 *
 * The gate reaches Nx and Biome as `pnpm exec`, so a `pnpm` earlier on PATH
 * records and stubs exactly the invocations that do work — `affected`,
 * `run-many`, `run`, and the formatter — and falls through to the real pnpm for
 * everything else. The selection the gate dispatches over is therefore resolved
 * by the real project graph against the real range; only the running of the
 * suites is withheld, which is the one thing a spec cannot afford to do for
 * real and the one thing this is not asserting about.
 */
function gateDispatches(
  recipe: string,
  range?: { base: string; head: string },
) {
  const shimDirectory = mkdtempSync(join(scratch, "dispatch-"));
  const log = join(shimDirectory, "dispatched.log");
  writeFileSync(log, "");
  const shim = join(shimDirectory, "pnpm");
  writeFileSync(
    shim,
    `#!/usr/bin/env bash\n` +
      `if [ "$1" = exec ] && { [ "$3" = affected ] || [ "$3" = run-many ] || [ "$3" = run ] || [ "$2" = biome ]; }; then\n` +
      `  printf '%s\\n' "$*" >> "${log}"; exit 0\n` +
      `fi\n` +
      `exec "${realPnpm}" "$@"\n`,
  );
  chmodSync(shim, 0o755);
  const result = spawnSync("just", [recipe], {
    cwd: workspace,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${shimDirectory}:${process.env.PATH ?? ""}`,
      ...(range ? { NX_BASE: range.base, NX_HEAD: range.head } : {}),
    },
  });
  expect(result.status).toBe(0);
  return readFileSync(log, "utf8").trim().split("\n").filter(Boolean);
}

/** Nx's own task graph for a dispatch, without running any of it. */
function browserTasks(lanes: readonly string[]) {
  const graphFile = join(scratch, `tasks-${lanes.join("-")}.json`);
  execFileSync(
    "pnpm",
    [
      "exec",
      "nx",
      "run-many",
      "-t",
      "e2e,screenshot",
      "-p",
      lanes.join(","),
      `--graph=${graphFile}`,
    ],
    { cwd: workspace, encoding: "utf8", stdio: "pipe" },
  );
  const { tasks } = taskGraphSchema.parse(
    JSON.parse(readFileSync(graphFile, "utf8")),
  );
  return Object.keys(tasks.tasks).filter((task) =>
    /:(e2e|screenshot)$/.test(task),
  );
}

/**
 * The one diagnostic a recipe wrote, of everything on its standard error.
 *
 * A recipe line without a `@` prefix is echoed to standard error before it runs,
 * so the line's source — including the text of every other diagnostic it could
 * have written — can be on the stream beside the one it did, and what a
 * dependency wrote is there too. Reading the refusal as the line it is keeps
 * either from answering for it.
 */
function diagnosticLine(stderr: string, prefix: string) {
  const lines = stderr.split("\n").filter((line) => line.startsWith(prefix));
  expect(lines).toHaveLength(1);
  return lines[0];
}

/** The dispatches that would run a browser suite, of everything a gate ran. */
const browserDispatches = (dispatched: readonly string[]) =>
  dispatched.filter((dispatch) => dispatch.includes("e2e"));

describe("the gate's browser lanes", () => {
  it("runs the composed artifact's suite once for a change that affects it", () => {
    // A remote's page source: the shell is affected by it, because the shell
    // owns the `eslint .` run whose key covers every TypeScript file.
    const head = scenarioCommit("apps/awards/src/page.tsx", "// scenario");

    const lanes = lanesFor("HEAD", head);
    expect(lanes).toEqual(["awards", "shell"]);

    const dispatched = gateDispatches("check", { base: "HEAD", head });
    expect(browserDispatches(dispatched)).toEqual([
      "exec nx run-many -t e2e,screenshot -p awards,shell --parallel=3",
    ]);
    // One dispatch, and one `shell:e2e` inside it. Before this the same range
    // reached that suite through the affected batch and again unconditionally.
    expect(browserTasks(lanes).filter((task) => task === "shell:e2e")).toEqual([
      "shell:e2e",
    ]);
    expect(browserTasks(lanes)).toEqual(
      expect.arrayContaining(["awards:e2e", "awards:screenshot"]),
    );
  });

  it("runs the composed artifact's suite once for a change that does not affect it", () => {
    // An owned stylesheet is in no other project's key, so the affected
    // selection stops at the remote that owns it and never reaches the shell.
    const head = scenarioCommit(
      "apps/software/src/software.css",
      "/* scenario */",
    );

    const lanes = lanesFor("HEAD", head);
    expect(lanes).toEqual(["shell", "software"]);

    const dispatched = gateDispatches("check", { base: "HEAD", head });
    expect(browserDispatches(dispatched)).toEqual([
      "exec nx run-many -t e2e,screenshot -p shell,software --parallel=3",
    ]);
    expect(browserTasks(lanes).filter((task) => task === "shell:e2e")).toEqual([
      "shell:e2e",
    ]);
  });

  it("gates the composed artifact when no affected project owns a browser suite", () => {
    // Documentation reaches no app, so affected selection alone would gate the
    // composed artifact with nothing at all. This is the case the unconditional
    // run existed for, and the reason the lane survives the selection.
    const head = scenarioCommit("docs/architecture.md", "<!-- scenario -->");

    const lanes = lanesFor("HEAD", head);
    expect(lanes).toEqual(["shell"]);

    const dispatched = gateDispatches("check", { base: "HEAD", head });
    expect(browserDispatches(dispatched)).toEqual([
      "exec nx run-many -t e2e,screenshot -p shell --parallel=3",
    ]);
    expect(browserTasks(lanes)).toEqual(["shell:e2e"]);
  });

  it("leaves the non-affected sweep dispatching every project and the composed artifact", () => {
    // check-all is CI's safety sweep over the whole workspace, deliberately
    // unchanged: its `--all` run already reaches every project, so the shape
    // asserted here is the one it had before the affected gate's lanes existed.
    const dispatched = gateDispatches("check-all");

    expect(browserDispatches(dispatched)).toEqual([
      "exec nx run-many -t e2e,screenshot --all --parallel=3",
      "exec nx run shell:e2e",
    ]);
  });

  it.each([
    ["not-a-commit", "HEAD"],
    ["HEAD", "not-a-commit"],
    ["--all", "HEAD"],
  ])("rejects a range that names no commit: %s..%s", (base, head) => {
    const result = spawnSync("just", ["gate-browser-lanes", base, head], {
      cwd: workspace,
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    // The refusal itself has to carry both halves, so it is read as the one
    // line a caller sees rather than as anything else on the stream: what
    // failed, and the command to run once it is not.
    const refusal = diagnosticLine(result.stderr, "gate-browser-lanes: ");
    expect(refusal).toContain("base and head must resolve to commits");
    expect(refusal).toContain("just gate-browser-lanes HEAD~1 HEAD");
    expect(refusal).toContain("rerun just gate-browser-lanes");
  });

  it("tells the gate's own caller what failed and what to rerun for a range that names no commit", () => {
    // The gate takes its range from the environment rather than arguments, so
    // its refusal has to name both halves itself: which variables are wrong,
    // and the command to run once they are not. It is read as one line for a
    // second reason here — the gate's dependency reports on the same stream
    // ahead of it, so the refusal is not the only thing on it.
    const result = spawnSync("just", ["check"], {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, NX_BASE: "not-a-commit", NX_HEAD: "HEAD" },
    });

    expect(result.status).toBe(2);
    const refusal = diagnosticLine(result.stderr, "check: ");
    expect(refusal).toContain("NX_BASE and NX_HEAD must resolve to commits");
    expect(refusal).toContain("rerun just check");
  });
});
