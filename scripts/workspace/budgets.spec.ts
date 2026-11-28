import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * The onebudgetspec budgets `just budgets` runs, and the gate that runs them.
 *
 * Every scenario runs the real recipe as a subprocess over a copy of this
 * working tree, so the justfile, `nx.json`'s `budgets`/`budgets-host` target
 * defaults, the real Nx project graph and the pinned onebudgetspec release are
 * all the ones that ship. What a scenario adds is a budget: a domain project
 * declaring the two budget targets, or a root `budgets.yaml`, whose one
 * `reported` budget reports a fixed figure. Whether it is within or over its
 * threshold is the only thing the scenarios vary, so the verdict each asserts is
 * the one onebudgetspec reached and the gate propagated.
 *
 * The copy is a git repository of its own with one commit, so the affected tier
 * resolves a real range against it and nothing here writes to this checkout.
 */

const workspace = process.cwd();
/** The real bun the gate shim falls through to; see gate-browser-lanes.spec.ts. */
const executablePath = z.string().regex(/^\/[A-Za-z0-9._+/-]+$/);
/** A path inside the copied tree: relative, and never climbing out of it. */
const workspacePath = z
  .string()
  .min(1)
  .refine((path) => !isAbsolute(path) && !path.split("/").includes(".."), {
    message: "must be a workspace-relative path that stays inside the tree",
  });
const budgetResults = z.object({
  results: z.array(z.object({ id: z.string(), verdict: z.string() })),
});

const fixtureIdentity = {
  GIT_AUTHOR_NAME: "Budgets fixture",
  GIT_AUTHOR_EMAIL: "budgets@example.test",
  GIT_COMMITTER_NAME: "Budgets fixture",
  GIT_COMMITTER_EMAIL: "budgets@example.test",
};

let scratch: string;
let realBun: string;
let trackedFiles: string[];
let installTrees: string[];

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "budgets-"));
  realBun = executablePath.parse(
    execFileSync("bash", ["-c", "command -v bun"], { encoding: "utf8" }).trim(),
  );
  // The working tree as git sees it, uncommitted edits included, so the recipe
  // under test is the one on disk rather than the last commit's.
  trackedFiles = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: workspace, encoding: "utf8" },
  )
    .split("\0")
    .filter((path) => path !== "")
    .map((path) => workspacePath.parse(path))
    .filter((path) => existsSync(join(workspace, path)));
  // The installed dependencies and pinned CI tools are linked rather than
  // copied: they are the same install the gate runs from here.
  installTrees = execFileSync(
    "bash",
    [
      "-c",
      "shopt -s nullglob; printf '%s\\n' node_modules */*/node_modules .tools",
    ],
    { cwd: workspace, encoding: "utf8" },
  )
    .split("\n")
    .filter((path) => path !== "")
    .map((path) => workspacePath.parse(path))
    .filter((path) => existsSync(join(workspace, path)));
});

/** A one-commit git copy of this working tree, with `extra` files added. */
function workspaceCopy(name: string, extra: Record<string, string> = {}) {
  const copy = join(scratch, name);
  mkdirSync(copy);
  execFileSync(
    "bash",
    ["-c", 'tar --null -T - -cf - | tar -xf - -C "$1"', "copy", copy],
    { cwd: workspace, input: `${trackedFiles.join("\0")}\0` },
  );
  for (const tree of installTrees) {
    symlinkSync(join(workspace, tree), join(copy, tree));
  }
  for (const [path, content] of Object.entries(extra)) {
    mkdirSync(dirname(join(copy, path)), { recursive: true });
    writeFileSync(join(copy, path), content);
  }
  commitAll(copy, "fixture");
  return copy;
}

function commitAll(copy: string, message: string) {
  const git = (args: string[]) =>
    execFileSync("git", args, {
      cwd: copy,
      // llmlint: ignore[boundary_inputs_validated] The environment is forwarded to git, never read here; git needs the caller's PATH and HOME to start, and the only values this commit depends on are the fixture identity set from constants above.
      env: { ...process.env, ...fixtureIdentity },
      stdio: "pipe",
    });
  if (!existsSync(join(copy, ".git"))) git(["init", "-q"]);
  git(["add", "-A"]);
  git(["commit", "-q", "--no-verify", "-m", message]);
}

/** A budgets file whose one budget reports `actual` bytes against 100. */
function budgetsFile(id: string, actual: number) {
  // onebudgetspec names the file a `reported` measure writes; the fixture
  // refuses to run unless that is an absolute path rather than guess at one.
  const report = `const out = process.env.ONEBUDGETSPEC_RESULT; if (!out || !require("node:path").isAbsolute(out)) { console.error("fixture: ONEBUDGETSPEC_RESULT must be the absolute path of the result file onebudgetspec reads"); process.exit(2); } require("node:fs").writeFileSync(out, JSON.stringify({ value: ${actual} }))`;
  return [
    "schema_version: 1",
    "budgets:",
    `  - id: ${id}`,
    "    description: Payload bytes the fixture reports; guards that a budget over its threshold fails the gate.",
    "    measure: reported",
    `    command: ["node", "-e", ${JSON.stringify(report)}]`,
    "    unit: bytes",
    "    direction: max",
    "    threshold: 100",
    "",
  ].join("\n");
}

const domain = "budget-fixture";
const domainBudget = `${domain}-bytes`;
const domainResults = `target/budget-results/${domain}.json`;

/**
 * A budget domain laid out as the create-repo onebudgetspec reference states:
 * its project's `budgets` target checks its file, minus the `host` label, and
 * saves its results; `budgets-host` checks the `host` ones. Every other field
 * comes from `nx.json`'s target defaults.
 */
function domainProject(actual: number) {
  return {
    [`${domain}/budgets.yaml`]: budgetsFile(domainBudget, actual),
    [`${domain}/project.json`]: `${JSON.stringify(
      {
        name: domain,
        targets: {
          budgets: {
            executor: "nx:run-commands",
            outputs: [`{workspaceRoot}/${domainResults}`],
            options: {
              command: `onebudgetspec check ${domain}/budgets.yaml --exclude-label host --save-results ${domainResults}`,
            },
          },
          "budgets-host": {
            executor: "nx:run-commands",
            options: {
              command: `onebudgetspec check ${domain}/budgets.yaml --label host`,
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  };
}

/**
 * Nx runs in-process and caches into the copy's own directory, so no scenario
 * replays another's verdict or writes into the shared cache.
 */
function nxEnvironment(copy: string, extra: Record<string, string> = {}) {
  return {
    // llmlint: ignore[boundary_inputs_validated] The environment is forwarded to just and Nx, never read here; they need the caller's PATH, HOME and Node resolution to start, and every Nx setting a scenario depends on is overridden below from the copy the test created.
    ...process.env,
    NX_DAEMON: "false",
    NX_NO_CLOUD: "true",
    NX_CACHE_DIRECTORY: join(copy, ".nx-cache"),
    NX_BASE: "HEAD",
    NX_HEAD: "HEAD",
    ...extra,
  };
}

function just(copy: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync("just", args, {
    cwd: copy,
    encoding: "utf8",
    env: nxEnvironment(copy, env),
  });
}

describe("just budgets", () => {
  it("passes a domain's budget that is within its threshold, having measured it", () => {
    const copy = workspaceCopy("domain-within", domainProject(40));

    const result = just(copy, ["budgets", "all"]);

    expect(result.stderr).not.toContain("budgets: ");
    expect(result.status).toBe(0);
    // The pass is the measurement's, not an empty selection's: the domain's
    // target ran and onebudgetspec saved its verdict.
    const saved = budgetResults.parse(
      JSON.parse(readFileSync(join(copy, domainResults), "utf8")),
    );
    expect(saved.results).toEqual([
      expect.objectContaining({ id: domainBudget, verdict: "within" }),
    ]);
  });

  it("fails a domain's budget that is over its threshold, naming it", () => {
    const copy = workspaceCopy("domain-over", domainProject(400));

    const result = just(copy, ["budgets", "all"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `budget ${domainBudget}: actual 400 bytes, budget 100 bytes`,
    );
    expect(result.stderr).toContain(
      "budgets: a project budget is over its threshold or could not be measured; fix what the report above names, then rerun just budgets all",
    );
  });

  it("checks the root budgets.yaml on every run, passing within and failing over", () => {
    const within = workspaceCopy("root-within", {
      "budgets.yaml": budgetsFile("site-root-bytes", 40),
    });
    const over = workspaceCopy("root-over", {
      "budgets.yaml": budgetsFile("site-root-bytes", 400),
    });

    const passed = just(within, ["budgets"]);
    const failed = just(over, ["budgets"]);

    expect(passed.stderr).not.toContain("budgets: ");
    expect(passed.status).toBe(0);
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain(
      "budget site-root-bytes: actual 400 bytes, budget 100 bytes",
    );
    expect(failed.stderr).toContain(
      "budgets: a budget in budgets.yaml is over its threshold or could not be measured; fix what the report above names, then rerun just budgets",
    );
  });

  it("runs on the affected tier only the domains the range reaches", () => {
    const copy = workspaceCopy("affected", domainProject(40));
    const head = () =>
      execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: copy,
        encoding: "utf8",
      }).trim();
    const before = head();
    writeFileSync(
      join(copy, `${domain}/budgets.yaml`),
      budgetsFile(domainBudget, 400),
    );
    commitAll(copy, "raise the fixture's figure over its threshold");
    const after = head();

    // A range that changes nothing reaches no domain, so the over-threshold
    // budget is not run; the range that raised it reaches it and fails.
    const unreached = just(copy, ["budgets"], {
      NX_BASE: after,
      NX_HEAD: after,
    });
    const reached = just(copy, ["budgets"], {
      NX_BASE: before,
      NX_HEAD: after,
    });

    expect(unreached.stderr).not.toContain("budgets: ");
    expect(unreached.status).toBe(0);
    expect(reached.status).toBe(1);
    expect(reached.stderr).toContain(
      `budget ${domainBudget}: actual 400 bytes`,
    );
    expect(reached.stderr).toContain(
      "budgets: a project budget is over its threshold or could not be measured; fix what the report above names, then rerun just budgets",
    );
  });

  it("refuses a range that names no commit, and a tier it does not know", () => {
    const copy = workspaceCopy("refusals");

    const badRange = just(copy, ["budgets"], { NX_BASE: "not-a-commit" });
    const badTier = just(copy, ["budgets", "everything"]);

    expect(badRange.status).toBe(2);
    expect(badRange.stderr).toContain(
      "budgets: NX_BASE and NX_HEAD must resolve to commits",
    );
    expect(badRange.stderr).toContain("rerun just budgets");
    expect(badTier.status).not.toBe(0);
    expect(badTier.stderr).toContain(
      "budgets: unknown tier 'everything'; use affected (the default) or all",
    );
  });
});

describe("just check runs the budgets", () => {
  /**
   * The gate with its suites withheld: a `bun` earlier on PATH records and
   * succeeds every Biome run and every Nx batch except the budgets one, as
   * gate-browser-lanes.spec.ts does for the browser lanes. Everything else —
   * `lint-workflows`, the range check, the lane selection, the budgets batch
   * and onebudgetspec itself — runs for real, so a budget over its threshold is
   * the scenario's only failure.
   */
  function gate(copy: string, args: string[]) {
    const shimDirectory = join(copy, ".gate-shim");
    mkdirSync(shimDirectory);
    const log = join(shimDirectory, "dispatched.log");
    writeFileSync(log, "");
    const shim = join(shimDirectory, "bun");
    writeFileSync(
      shim,
      "#!/usr/bin/env bash\n" +
        `if [ "$1" = x ] && { [ "$2" = biome ] || { [ "$2" = nx ] && [[ " $* " != *" budgets "* ]] && { [ "$3" = affected ] || [ "$3" = run-many ]; }; }; }; then\n` +
        `  printf '%s\\n' "$*" >> "${log}"; exit 0\n` +
        "fi\n" +
        `exec "${realBun}" "$@"\n`,
    );
    chmodSync(shim, 0o755);
    const result = just(copy, args, {
      // llmlint: ignore[boundary_inputs_validated] The ambient PATH is only forwarded behind the shim so just and Nx can start; the one binary resolved from it, bun, is validated as an absolute path in beforeAll.
      PATH: `${shimDirectory}:${process.env.PATH ?? ""}`,
    });
    const dispatched = readFileSync(log, "utf8").trim().split("\n");
    return { result, dispatched };
  }

  it("fails the affected gate when its only failure is one budget over its threshold", () => {
    const copy = workspaceCopy("gate-affected", {
      "budgets.yaml": budgetsFile("site-root-bytes", 400),
    });

    const { result, dispatched } = gate(copy, ["check"]);

    // Every suite batch ran and passed before the budgets did.
    expect(dispatched).toEqual([
      "x biome check --error-on-warnings .",
      "x nx affected --base=HEAD --head=HEAD -t lint --parallel=3 --args=--error-on-warnings",
      "x nx affected --base=HEAD --head=HEAD -t typecheck,test,build,prerender --parallel=3",
      "x nx run-many -t e2e,screenshot -p shell --parallel=3",
    ]);
    expect(result.stderr).not.toContain("check: ");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "budget site-root-bytes: actual 400 bytes, budget 100 bytes",
    );
  });

  it("runs the budgets at the full sweep's tier on just check all", () => {
    const copy = workspaceCopy("gate-all", domainProject(400));

    const { result, dispatched } = gate(copy, ["check", "all"]);

    expect(dispatched).toEqual([
      "x biome check --error-on-warnings .",
      "x nx run-many --all -t lint --parallel=3 --args=--error-on-warnings",
      "x nx run-many --all -t typecheck,test,build,prerender --parallel=3",
      "x nx run-many -t e2e,screenshot --all --parallel=3",
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`budget ${domainBudget}: actual 400 bytes`);
    expect(result.stderr).toContain("rerun just budgets all");
  });
});
