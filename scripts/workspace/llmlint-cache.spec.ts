import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, onTestFinished } from "vitest";

/**
 * What a recorded verdict is a statement about.
 *
 * `scripts/workspace/AGENTS.md` states the contract; these journeys are what holds the
 * tier to it. Each drives the whole dispatch — `lint-llm-diff.mjs`, the
 * `llmlint-fingerprint.mjs` and `llmlint-runtime.mjs` it keys the run with, real
 * Nx, and the `llmlint-judge.mjs` target body — through the real
 * `just lint-llm-diff` recipe, and reads the verdict's provenance off the run.
 * A key that stopped covering something, or started covering which caller
 * asked, fails here rather than replaying a green nothing was checked against.
 *
 * Only llmlint stands in, as `llmlint-stub.mjs` on PATH under its name: it is
 * the billed, networked third party whose non-determinism is the defect under
 * test, and a real one could not tell a replayed verdict from a re-rolled one
 * that happened to agree.
 */

const workspace = process.cwd();

/** The commit a revision names, which is what a verdict is recorded against. */
const commitOf = (revision: string) =>
  execFileSync("git", ["rev-parse", "--verify", `${revision}^{commit}`], {
    cwd: workspace,
    encoding: "utf8",
  }).trim();

/**
 * The separator the stand-in records one judgement's arguments with, chosen so a
 * recorded argument is exactly the one llmlint received even when it contains
 * whitespace. Built from its character code so this file carries no control
 * character of its own.
 */
const unitSeparator = String.fromCharCode(31);

interface Judge {
  /** The directory to put in front of PATH so this stands in for llmlint. */
  readonly directory: string;
  /** What the stand-in reads to decide its answers, merged into every dispatch. */
  readonly environment: Record<string, string>;
  /** Every judgement asked of it, in order; `config` and `--version` are not judgements. */
  invocations(): string[][];
}

/**
 * llmlint, stood in for by `llmlint-stub.mjs` copied onto PATH under its name.
 *
 * llmlint: ignore-block[e2e_not_mocked] The subject of these journeys is the cached dispatch around the judge, and it is driven whole: the real `just lint-llm-diff` recipe, the real fingerprint, real Nx hashing, and the real target body. Only llmlint itself stands in, because it is a billed model call whose non-determinism is the defect under test — a real one could not tell a replayed verdict from a re-rolled one that happened to agree, would make a deterministic gate depend on the network, and would break `just check` for anyone who has not also run `just setup-llmlint`, which `just bootstrap` does not. The real llmlint is driven by `just lint-llm-diff` itself, which is the gate.
 */
function stubJudge(): Judge {
  const directory = mkdtempSync(path.join(tmpdir(), "llmlint-judge-stub-"));
  onTestFinished(() => rmSync(directory, { force: true, recursive: true }));
  const record = path.join(directory, "judgements");
  const configCalls = path.join(directory, "config-calls");
  writeFileSync(record, "");
  writeFileSync(configCalls, "");
  copyFileSync(
    path.join(workspace, "scripts/workspace/llmlint-stub.mjs"),
    path.join(directory, "llmlint"),
  );
  chmodSync(path.join(directory, "llmlint"), 0o755);
  return {
    directory,
    environment: {
      LLMLINT_STUB_CONFIG_CALLS: configCalls,
      LLMLINT_STUB_NAMESPACE: randomUUID(),
      LLMLINT_STUB_RECORD: record,
    },
    invocations: () =>
      readFileSync(record, "utf8")
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => line.split(unitSeparator).slice(0, -1)),
  };
}
// llmlint: ignore-end[e2e_not_mocked]

interface Run {
  status: number | null;
  output: string;
  /** Whether Nx replayed the recorded verdict rather than asking the judge. */
  replayed: boolean;
}

/**
 * The Nx cache and workspace database these journeys share, so none of them
 * reads or writes a contributor's.
 *
 * Shared rather than one per journey because Nx recomputes the project graph for
 * a database it has not seen, which costs more than every judgement here put
 * together — and this suite runs beside the browser suites, where that time is
 * paid in contention. Each journey still starts from a key nothing has recorded:
 * `stubJudge` gives it a judge configuration of its own, so its keys cannot
 * collide with another journey's. Nx's daemon lives in that database, so these
 * runs go without one rather than start it for a directory about to be
 * discarded.
 */
const nxDirectory = mkdtempSync(path.join(tmpdir(), "llmlint-cache-nx-"));
afterAll(() => rmSync(nxDirectory, { force: true, recursive: true }));

interface Dispatch {
  args?: string[];
  judge: Judge;
  environment?: Record<string, string>;
}

// llmlint: ignore-block[boundary_inputs_validated] What survives the filter is forwarded, never read: `just` and the `pnpm exec nx` it dispatches need the caller's PATH, HOME, and Node resolution to start at all, and nothing here parses, branches on, or interpolates any of it. Every Nx setting is dropped instead of forwarded, and the ones these journeys depend on are set from a directory the journey itself created.
/** One `just lint-llm-diff`, exactly as a contributor or a gate runs it. */
function lintLlmDiff({ args = [], judge, environment = {} }: Dispatch): Run {
  const result = spawnSync("just", ["lint-llm-diff", ...args], {
    cwd: workspace,
    encoding: "utf8",
    timeout: 180_000,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith("NX_")),
      ),
      NX_CACHE_DIRECTORY: path.join(nxDirectory, "cache"),
      NX_DAEMON: "false",
      NX_WORKSPACE_DATA_DIRECTORY: path.join(nxDirectory, "data"),
      PATH: `${judge.directory}${path.delimiter}${process.env.PATH ?? ""}`,
      ...judge.environment,
      ...environment,
    },
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const replayed = /^lint-llm-diff: replayed the recorded verdict/m.test(
    output,
  );
  const judged = /^lint-llm-diff: judged this diff/m.test(output);
  if (replayed === judged)
    throw new Error(
      `just lint-llm-diff reported neither one provenance nor the other: ${output}`,
    );
  return { status: result.status, output, replayed };
}
// llmlint: ignore-end[boundary_inputs_validated]

describe("an unchanged tree judged against an unchanged base", () => {
  it("replays the recorded verdict instead of asking the judge again", () => {
    const judge = stubJudge();

    const base = commitOf("origin/master");

    const judged = lintLlmDiff({ judge });
    expect(judged.status).toBe(0);
    expect(judge.invocations()).toEqual([["--diff", "--diff-base", base]]);
    // A green is one line here, as it is for every other recipe in this
    // repository: which verdict this is, and what base it is a verdict about.
    expect(judged.output.trim()).toBe(
      `lint-llm-diff: judged this diff against base ${base} (Nx cache miss)`,
    );

    const replayed = lintLlmDiff({ judge });

    expect(replayed.status).toBe(0);
    // The judge was not asked a second time — read from what it received, not
    // from the wording of the run that replayed it.
    expect(judge.invocations()).toHaveLength(1);
    expect(replayed.output.trim()).toBe(
      `lint-llm-diff: replayed the recorded verdict for base ${base} (Nx cache hit)`,
    );
  }, 300_000);

  it("re-judges when any byte of the workspace changes", () => {
    const judge = stubJudge();

    expect(lintLlmDiff({ judge }).replayed).toBe(false);
    expect(lintLlmDiff({ judge }).replayed).toBe(true);

    // A file the judge would be handed and no other check reads, added and
    // removed by this journey. The diff it makes is inert; that the key notices
    // it at all is the claim — a green replayed for bytes no judge saw is the
    // one failure of this tier that is silent.
    const probe = path.join(
      workspace,
      `docs/llmlint-cache-probe-${randomUUID()}.md`,
    );
    writeFileSync(
      probe,
      "A cache journey's probe file, removed before it returns.\n",
    );
    try {
      const changed = lintLlmDiff({ judge });

      expect(changed.replayed).toBe(false);
      expect(judge.invocations()).toHaveLength(2);
    } finally {
      rmSync(probe, { force: true });
    }

    // And removing it again returns the tree to the one already judged.
    expect(lintLlmDiff({ judge }).replayed).toBe(true);
  }, 300_000);

  it("keys that verdict on the base resolved to a commit, never on the ref", () => {
    const judge = stubJudge();
    // A remote-tracking ref this journey owns, so what it names can move under
    // the same spelling the way a rebased or advanced base does.
    const ref = `origin/lint-llm-diff-probe-${randomUUID()}`;
    const moving = `refs/remotes/${ref}`;
    execFileSync("git", ["update-ref", moving, commitOf("HEAD")], {
      cwd: workspace,
    });
    onTestFinished(() => {
      execFileSync("git", ["update-ref", "-d", moving], { cwd: workspace });
    });

    const first = lintLlmDiff({ args: [ref], judge });
    expect(first.replayed).toBe(false);
    expect(judge.invocations()).toEqual([
      ["--diff", "--diff-base", commitOf("HEAD")],
    ]);

    execFileSync("git", ["update-ref", moving, commitOf("HEAD~1")], {
      cwd: workspace,
    });
    const advanced = lintLlmDiff({ args: [ref], judge });

    // Same spelling, different commit: the verdict recorded for the old one
    // must not answer for the new one.
    expect(advanced.replayed).toBe(false);
    expect(judge.invocations()).toEqual([
      ["--diff", "--diff-base", commitOf("HEAD")],
      ["--diff", "--diff-base", commitOf("HEAD~1")],
    ]);
  }, 300_000);

  it("names that base from the comparison identity a dispatch already exported", () => {
    const judge = stubJudge();
    const branch = `lint-llm-diff-comparison-${randomUUID()}`;
    const named = `refs/remotes/origin/${branch}`;
    execFileSync("git", ["update-ref", named, commitOf("HEAD~1")], {
      cwd: workspace,
    });
    onTestFinished(() => {
      execFileSync("git", ["update-ref", "-d", named], { cwd: workspace });
    });

    const run = lintLlmDiff({
      judge,
      environment: {
        ONEVCS_COMPARISON_BASE: branch,
        ONEVCS_COMPARISON_REMOTE: "origin",
      },
    });

    expect(run.status).toBe(0);
    // Resolved from the identity the dispatch named rather than rediscovered,
    // so the push that follows a worker's gate replays what that gate cleared.
    expect(judge.invocations()).toEqual([
      ["--diff", "--diff-base", commitOf("HEAD~1")],
    ]);
  }, 300_000);
});

describe("the key describes the judge, not the caller", () => {
  it("gives two callers over one tree and base the same key", () => {
    const judge = stubJudge();

    // Two dispatchers, each injecting its own oneharness wrapper the way an
    // orchestrator checkout and a contributor's shell do. `llmlint config`
    // renders that path, so reading it from the caller hashed one judged diff to
    // a different key per dispatch and the judge re-rolled every round.
    const worker = lintLlmDiff({
      judge,
      environment: {
        LLMLINT_ONEHARNESS_BIN:
          "/opt/dispatcher-a/scripts/llmlint-oneharness.sh",
      },
    });
    expect(worker.replayed).toBe(false);

    const push = lintLlmDiff({
      judge,
      environment: {
        LLMLINT_ONEHARNESS_BIN:
          "/srv/dispatcher-b/scripts/llmlint-oneharness.sh",
      },
    });

    expect(push.replayed).toBe(true);
    expect(judge.invocations()).toHaveLength(1);
  }, 300_000);

  it("re-judges when the judge configuration alone changes", () => {
    const judge = stubJudge();

    const before = lintLlmDiff({ judge });
    expect(before.replayed).toBe(false);

    // Nothing in the tree and nothing about the base has moved; a rule in a
    // plugin fetched from outside this repository has, which no tracked file
    // records and only the fingerprint can carry.
    const after = lintLlmDiff({
      judge,
      environment: { LLMLINT_STUB_RULES: "plugin-rule-tightened" },
    });
    expect(after.replayed).toBe(false);
    expect(judge.invocations()).toHaveLength(2);

    // And the entry the first run recorded is still the answer for the
    // configuration it was recorded under.
    const restored = lintLlmDiff({ judge });
    expect(restored.replayed).toBe(true);
    expect(judge.invocations()).toHaveLength(2);
  }, 300_000);

  it("re-judges when the installed judge changes", () => {
    const judge = stubJudge();

    expect(lintLlmDiff({ judge }).replayed).toBe(false);
    const upgraded = lintLlmDiff({
      judge,
      environment: { LLMLINT_STUB_VERSION: "llmlint 0.0.1-stub" },
    });

    expect(upgraded.replayed).toBe(false);
    expect(judge.invocations()).toHaveLength(2);
  }, 300_000);

  it("refuses the run when the judge configuration cannot be fingerprinted", () => {
    const judge = stubJudge();
    // An llmlint that cannot report its own configuration. Nx scores a runtime
    // input that exits non-zero as no contribution rather than as an error, so
    // this is the case that would otherwise drop the judge configuration out of
    // the key in silence and replay a verdict it has moved on from.
    writeFileSync(
      path.join(judge.directory, "llmlint"),
      "#!/usr/bin/env bash\nexit 3\n",
      { mode: 0o755 },
    );

    const refused = spawnSync("just", ["lint-llm-diff"], {
      cwd: workspace,
      encoding: "utf8",
      timeout: 180_000,
      // llmlint: ignore[boundary_inputs_validated] Same forwarded-not-read environment as every journey above; this one cannot go through `lintLlmDiff` because the run it drives is refused before Nx is dispatched, so it reports no cache provenance for that helper to read.
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([name]) => !name.startsWith("NX_"),
          ),
        ),
        NX_CACHE_DIRECTORY: path.join(nxDirectory, "cache"),
        NX_DAEMON: "false",
        NX_WORKSPACE_DATA_DIRECTORY: path.join(nxDirectory, "data"),
        PATH: `${judge.directory}${path.delimiter}${process.env.PATH ?? ""}`,
        ...judge.environment,
      },
    });

    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toContain(
      "lint-llm-diff: the judge configuration could not be fingerprinted",
    );
    expect(refused.stderr).toContain("was not judged");
  }, 300_000);

  it("fails the tier when the judge configuration shifts under a keyed run", () => {
    const judge = stubJudge();

    // The dispatcher keys the run on the configuration it resolves, and the
    // target answers under the one it resolves; this journey moves the second
    // out from under the first. Nothing is recorded for a key that describes a
    // judge other than the one that ran.
    const refused = lintLlmDiff({
      judge,
      environment: { LLMLINT_STUB_SHIFTED_RULES: "changed-mid-dispatch" },
    });

    expect(refused.status).not.toBe(0);
    expect(refused.output).toContain(
      "lint-llm-diff: the judge configuration changed between keying this run",
    );
    // A failure carrying neither verdict is one the judge never got to, and is
    // reported as that rather than as findings a reader could go and clear.
    expect(refused.output).toContain(
      "lint-llm-diff: the judged tier failed before the judge could answer",
    );
    expect(refused.output).not.toContain("reported the findings above");
    expect(judge.invocations()).toEqual([]);
  }, 300_000);
});

describe("the stand-in judge's own scratch files", () => {
  // The stand-in runs on PATH under llmlint's name and appends to whatever
  // `LLMLINT_STUB_RECORD` points at, so that value is its trust boundary. These
  // drive it the way every journey above does — as the `llmlint` executable —
  // and read the refusal off the process, then off the file it did not touch.
  const runStub = (record: string) => {
    const judge = stubJudge();
    return spawnSync(path.join(judge.directory, "llmlint"), ["--diff"], {
      encoding: "utf8",
      // llmlint: ignore[boundary_inputs_validated] The value under test is the one being refused; it is handed to the stand-in exactly as a journey's environment would hand it over, which is the boundary these cases exist to drive.
      env: {
        ...process.env,
        ...judge.environment,
        LLMLINT_STUB_RECORD: record,
      },
    });
  };

  /** A file outside every scratch directory, which nothing may write through. */
  const offLimitsFile = () => {
    const directory = mkdtempSync(
      path.join(workspace, "node_modules", ".llmlint-off-limits-"),
    );
    onTestFinished(() => rmSync(directory, { force: true, recursive: true }));
    const file = path.join(directory, "record");
    writeFileSync(file, "untouched\n");
    return file;
  };

  it("refuses a record outside the scratch directory", () => {
    const file = offLimitsFile();

    const refused = runStub(file);

    expect(refused.status).toBe(64);
    expect(refused.stderr).toContain(
      `LLMLINT_STUB_RECORD must name an existing file under ${realpathSync(tmpdir())}`,
    );
    expect(readFileSync(file, "utf8")).toBe("untouched\n");
  });

  it("refuses a record that reaches outside through a link", () => {
    const file = offLimitsFile();
    const directory = mkdtempSync(path.join(tmpdir(), "llmlint-escape-"));
    onTestFinished(() => rmSync(directory, { force: true, recursive: true }));
    const link = path.join(directory, "record");
    symlinkSync(file, link);

    const refused = runStub(link);

    expect(refused.status).toBe(64);
    expect(refused.stderr).toContain("LLMLINT_STUB_RECORD must name");
    expect(readFileSync(file, "utf8")).toBe("untouched\n");
  });
});

describe("only a verdict is recorded", () => {
  it("re-judges a run that reported findings", () => {
    const judge = stubJudge();
    const findings = { LLMLINT_STUB_VERDICT: "1" };

    const first = lintLlmDiff({ judge, environment: findings });
    expect(first.status).toBe(1);
    // The judge names the finding on its way out and the wrapper names what to
    // do with it, so the captured run carries both halves rather than a status.
    expect(first.output).toContain(
      "stub judge: the stand-in rule reported a finding",
    );
    expect(first.output).toContain(
      "lint-llm-diff: the judge reported the findings above",
    );

    const second = lintLlmDiff({
      judge,
      environment: findings,
    });

    expect(second.status).toBe(1);
    expect(second.replayed).toBe(false);
    expect(judge.invocations()).toHaveLength(2);
  }, 300_000);

  it("re-judges a run that never reached a verdict", () => {
    const judge = stubJudge();
    const broken = { LLMLINT_STUB_VERDICT: "2" };

    const first = lintLlmDiff({ judge, environment: broken });
    expect(first.status).not.toBe(0);
    // Reported as what it is rather than as findings to go clear, because Nx
    // collapses both to one failing status on the way out — by the judge, which
    // is the only side that knows a rule was never reached, and by the wrapper.
    expect(first.output).toContain(
      "stub judge: the stand-in toolchain stopped before any rule was judged",
    );
    expect(first.output).toContain(
      "lint-llm-diff: the judge never reached a verdict",
    );
    expect(first.output).not.toContain("reported the findings above");
    expect(first.output).not.toContain("before the judge could answer");

    const second = lintLlmDiff({ judge, environment: broken });

    expect(second.replayed).toBe(false);
    expect(judge.invocations()).toHaveLength(2);
  }, 300_000);

  it("replays a narrowed run only for the same narrowing", () => {
    const judge = stubJudge();
    const narrowed = ["HEAD~1", "justfile"];

    expect(lintLlmDiff({ args: narrowed, judge }).replayed).toBe(false);
    expect(lintLlmDiff({ args: narrowed, judge }).replayed).toBe(true);

    // llmlint's trailing FILES positional replaces the configured globs, so the
    // green above covers one file's rules. It may not answer for the tree.
    const whole = lintLlmDiff({ args: ["HEAD~1"], judge });

    expect(whole.replayed).toBe(false);
    expect(judge.invocations()).toEqual([
      ["--diff", "--diff-base", commitOf("HEAD~1"), "justfile"],
      ["--diff", "--diff-base", commitOf("HEAD~1")],
    ]);
  }, 300_000);
});

describe("forcing a fresh judgement", () => {
  it("re-judges this tier alone for one invocation with --rejudge", () => {
    const judge = stubJudge();

    expect(lintLlmDiff({ judge }).replayed).toBe(false);
    expect(lintLlmDiff({ judge }).replayed).toBe(true);

    const forced = lintLlmDiff({
      args: ["origin/master", "--rejudge"],
      judge,
    });

    expect(forced.status).toBe(0);
    expect(forced.replayed).toBe(false);
    expect(judge.invocations()).toHaveLength(2);
    // It is one invocation's flag, so the next ordinary run is unaffected and
    // no other command's cache was discarded.
    expect(lintLlmDiff({ judge }).replayed).toBe(true);
    expect(judge.invocations()).toHaveLength(2);
  }, 300_000);

  it("reports and ignores an ambient global Nx cache skip", () => {
    const judge = stubJudge();

    expect(lintLlmDiff({ judge }).replayed).toBe(false);
    // Exported to force this tier, it would re-roll a non-deterministic judge
    // from every unrelated command — so this tier declines it and names the
    // per-invocation flag that does what the exporter wanted.
    const ambient = lintLlmDiff({
      judge,
      environment: { NX_SKIP_NX_CACHE: "true" },
    });

    expect(ambient.replayed).toBe(true);
    // Said as part of this run's one status line rather than beside it, so a
    // green stays one line and still names the flag that does what the exporter
    // wanted.
    expect(ambient.output.trim()).toBe(
      `lint-llm-diff: replayed the recorded verdict for base ${commitOf("origin/master")} (Nx cache hit) [ignoring the ambient global Nx cache skip, which would re-roll this non-deterministic judge from every unrelated command; force one fresh judgement of this tier alone with --rejudge]`,
    );
    expect(judge.invocations()).toHaveLength(1);
  }, 300_000);
});
