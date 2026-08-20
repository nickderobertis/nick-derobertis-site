import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";

/**
 * What a recorded verdict is a statement about.
 *
 * The LLM judge is non-deterministic, so a bare `llmlint --diff` took an
 * independent sample every time it was asked: four rolls over one branch's diff
 * named four different rules, and clearing the one a roll reported only changed
 * which rule the next one failed. `just lint-llm-diff` therefore dispatches the
 * cached Nx target `tooling-workspace:lint-llm-diff`, and a green is replayed
 * rather than re-rolled.
 *
 * That only holds while the key covers everything the verdict depends on, and
 * nothing it does not:
 *
 *   * the whole workspace, so a green is never replayed for bytes no judge saw;
 *   * the base, resolved to a commit, because a symbolic ref names a different
 *     diff the moment it advances;
 *   * the judged file list, because llmlint's trailing FILES positional replaces
 *     the configured globs, so a narrowed green covers a fraction of the rules;
 *   * the judge configuration in force — the installed llmlint version and the
 *     effective merged config — so a rule change in a plugin fetched from
 *     outside this repository invalidates it;
 *   * and *not* which caller asked, because a worker's gate and the publishing
 *     push that follows it must share the one verdict the worker paid for.
 *
 * Every journey below drives the real recipe and real Nx, so the whole dispatch
 * is exercised: `lint-llm-diff.mjs`, which resolves the base and keys the run;
 * `llmlint-fingerprint.mjs` and the `llmlint-runtime.mjs` both ends share, which
 * decide what the judge configuration hashes to; Nx's own hashing; and
 * `llmlint-judge.mjs`, the target's body. Only llmlint itself — the billed,
 * networked, non-deterministic third party whose re-rolling is the problem —
 * stands in, as `llmlint-stub.mjs` on PATH under its name.
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
 * A cache directory the calling journey owns, empty until that journey fills it.
 *
 * Nx keeps a cached result in two places — the outputs under
 * `NX_CACHE_DIRECTORY` and the record naming them in the database under
 * `NX_WORKSPACE_DATA_DIRECTORY` — so both move together for a journey to start
 * from nothing. Nx's daemon lives in that data directory, so these runs go
 * without one rather than start it for a directory about to be discarded.
 */
function ownCacheDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "llmlint-cache-nx-"));
  onTestFinished(() => rmSync(directory, { force: true, recursive: true }));
  return directory;
}

interface Dispatch {
  args?: string[];
  judge: Judge;
  cacheDirectory: string;
  environment?: Record<string, string>;
}

// llmlint: ignore-block[boundary_inputs_validated] What survives the filter is forwarded, never read: `just` and the `pnpm exec nx` it dispatches need the caller's PATH, HOME, and Node resolution to start at all, and nothing here parses, branches on, or interpolates any of it. Every Nx setting is dropped instead of forwarded, and the ones these journeys depend on are set from a directory the journey itself created.
/** One `just lint-llm-diff`, exactly as a contributor or a gate runs it. */
function lintLlmDiff({
  args = [],
  judge,
  cacheDirectory,
  environment = {},
}: Dispatch): Run {
  const result = spawnSync("just", ["lint-llm-diff", ...args], {
    cwd: workspace,
    encoding: "utf8",
    timeout: 180_000,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith("NX_")),
      ),
      NX_CACHE_DIRECTORY: path.join(cacheDirectory, "cache"),
      NX_DAEMON: "false",
      NX_WORKSPACE_DATA_DIRECTORY: path.join(cacheDirectory, "data"),
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
    const cacheDirectory = ownCacheDirectory();

    const base = commitOf("origin/master");

    const judged = lintLlmDiff({ judge, cacheDirectory });
    expect(judged.status).toBe(0);
    expect(judge.invocations()).toEqual([["--diff", "--diff-base", base]]);
    // A green is one line here, as it is for every other recipe in this
    // repository: which verdict this is, and what base it is a verdict about.
    expect(judged.output.trim()).toBe(
      `lint-llm-diff: judged this diff against base ${base} (Nx cache miss)`,
    );

    const replayed = lintLlmDiff({ judge, cacheDirectory });

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
    const cacheDirectory = ownCacheDirectory();

    expect(lintLlmDiff({ judge, cacheDirectory }).replayed).toBe(false);
    expect(lintLlmDiff({ judge, cacheDirectory }).replayed).toBe(true);

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
      const changed = lintLlmDiff({ judge, cacheDirectory });

      expect(changed.replayed).toBe(false);
      expect(judge.invocations()).toHaveLength(2);
    } finally {
      rmSync(probe, { force: true });
    }

    // And removing it again returns the tree to the one already judged.
    expect(lintLlmDiff({ judge, cacheDirectory }).replayed).toBe(true);
  }, 300_000);

  it("keys that verdict on the base resolved to a commit, never on the ref", () => {
    const judge = stubJudge();
    const cacheDirectory = ownCacheDirectory();
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

    const first = lintLlmDiff({ args: [ref], judge, cacheDirectory });
    expect(first.replayed).toBe(false);
    expect(judge.invocations()).toEqual([
      ["--diff", "--diff-base", commitOf("HEAD")],
    ]);

    execFileSync("git", ["update-ref", moving, commitOf("HEAD~1")], {
      cwd: workspace,
    });
    const advanced = lintLlmDiff({ args: [ref], judge, cacheDirectory });

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
    const cacheDirectory = ownCacheDirectory();
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
      cacheDirectory,
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
    const cacheDirectory = ownCacheDirectory();

    // Two dispatchers, each injecting its own oneharness wrapper the way an
    // orchestrator checkout and a contributor's shell do. `llmlint config`
    // renders that path, so reading it from the caller hashed one judged diff to
    // a different key per dispatch and the judge re-rolled every round.
    const worker = lintLlmDiff({
      judge,
      cacheDirectory,
      environment: {
        LLMLINT_ONEHARNESS_BIN:
          "/opt/dispatcher-a/scripts/llmlint-oneharness.sh",
      },
    });
    expect(worker.replayed).toBe(false);

    const push = lintLlmDiff({
      judge,
      cacheDirectory,
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
    const cacheDirectory = ownCacheDirectory();

    const before = lintLlmDiff({ judge, cacheDirectory });
    expect(before.replayed).toBe(false);

    // Nothing in the tree and nothing about the base has moved; a rule in a
    // plugin fetched from outside this repository has, which no tracked file
    // records and only the fingerprint can carry.
    const after = lintLlmDiff({
      judge,
      cacheDirectory,
      environment: { LLMLINT_STUB_RULES: "plugin-rule-tightened" },
    });
    expect(after.replayed).toBe(false);
    expect(judge.invocations()).toHaveLength(2);

    // And the entry the first run recorded is still the answer for the
    // configuration it was recorded under.
    const restored = lintLlmDiff({ judge, cacheDirectory });
    expect(restored.replayed).toBe(true);
    expect(judge.invocations()).toHaveLength(2);
  }, 300_000);

  it("re-judges when the installed judge changes", () => {
    const judge = stubJudge();
    const cacheDirectory = ownCacheDirectory();

    expect(lintLlmDiff({ judge, cacheDirectory }).replayed).toBe(false);
    const upgraded = lintLlmDiff({
      judge,
      cacheDirectory,
      environment: { LLMLINT_STUB_VERSION: "llmlint 0.0.1-stub" },
    });

    expect(upgraded.replayed).toBe(false);
    expect(judge.invocations()).toHaveLength(2);
  }, 300_000);

  it("refuses the run when the judge configuration cannot be fingerprinted", () => {
    const judge = stubJudge();
    const cacheDirectory = ownCacheDirectory();
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
        NX_CACHE_DIRECTORY: path.join(cacheDirectory, "cache"),
        NX_DAEMON: "false",
        NX_WORKSPACE_DATA_DIRECTORY: path.join(cacheDirectory, "data"),
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
    const cacheDirectory = ownCacheDirectory();

    // The dispatcher keys the run on the configuration it resolves, and the
    // target answers under the one it resolves; this journey moves the second
    // out from under the first. Nothing is recorded for a key that describes a
    // judge other than the one that ran.
    const refused = lintLlmDiff({
      judge,
      cacheDirectory,
      environment: { LLMLINT_STUB_SHIFTED_RULES: "changed-mid-dispatch" },
    });

    expect(refused.status).not.toBe(0);
    expect(refused.output).toContain(
      "lint-llm-diff: the judge configuration changed between keying this run",
    );
    expect(judge.invocations()).toEqual([]);
  }, 300_000);
});

describe("only a verdict is recorded", () => {
  it("re-judges a run that reported findings", () => {
    const judge = stubJudge();
    const cacheDirectory = ownCacheDirectory();
    const findings = { LLMLINT_STUB_VERDICT: "1" };

    const first = lintLlmDiff({ judge, cacheDirectory, environment: findings });
    expect(first.status).toBe(1);
    expect(first.output).toContain(
      "lint-llm-diff: the LLM judge reported the findings above",
    );

    const second = lintLlmDiff({
      judge,
      cacheDirectory,
      environment: findings,
    });

    expect(second.status).toBe(1);
    expect(second.replayed).toBe(false);
    expect(judge.invocations()).toHaveLength(2);
  }, 300_000);

  it("re-judges a run that never reached a verdict", () => {
    const judge = stubJudge();
    const cacheDirectory = ownCacheDirectory();
    const broken = { LLMLINT_STUB_VERDICT: "2" };

    const first = lintLlmDiff({ judge, cacheDirectory, environment: broken });
    expect(first.status).not.toBe(0);
    // Reported as what it is rather than as findings to go clear, because Nx
    // collapses both to one failing status on the way out.
    expect(first.output).toContain(
      "lint-llm-diff: the judge never reached a verdict",
    );
    expect(first.output).not.toContain("reported the findings above");

    const second = lintLlmDiff({ judge, cacheDirectory, environment: broken });

    expect(second.replayed).toBe(false);
    expect(judge.invocations()).toHaveLength(2);
  }, 300_000);

  it("replays a narrowed run only for the same narrowing", () => {
    const judge = stubJudge();
    const cacheDirectory = ownCacheDirectory();
    const narrowed = ["HEAD~1", "justfile"];

    expect(
      lintLlmDiff({ args: narrowed, judge, cacheDirectory }).replayed,
    ).toBe(false);
    expect(
      lintLlmDiff({ args: narrowed, judge, cacheDirectory }).replayed,
    ).toBe(true);

    // llmlint's trailing FILES positional replaces the configured globs, so the
    // green above covers one file's rules. It may not answer for the tree.
    const whole = lintLlmDiff({ args: ["HEAD~1"], judge, cacheDirectory });

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
    const cacheDirectory = ownCacheDirectory();

    expect(lintLlmDiff({ judge, cacheDirectory }).replayed).toBe(false);
    expect(lintLlmDiff({ judge, cacheDirectory }).replayed).toBe(true);

    const forced = lintLlmDiff({
      args: ["origin/master", "--rejudge"],
      judge,
      cacheDirectory,
    });

    expect(forced.status).toBe(0);
    expect(forced.replayed).toBe(false);
    expect(judge.invocations()).toHaveLength(2);
    // It is one invocation's flag, so the next ordinary run is unaffected and
    // no other command's cache was discarded.
    expect(lintLlmDiff({ judge, cacheDirectory }).replayed).toBe(true);
    expect(judge.invocations()).toHaveLength(2);
  }, 300_000);

  it("reports and ignores an ambient global Nx cache skip", () => {
    const judge = stubJudge();
    const cacheDirectory = ownCacheDirectory();

    expect(lintLlmDiff({ judge, cacheDirectory }).replayed).toBe(false);
    // Exported to force this tier, it would re-roll a non-deterministic judge
    // from every unrelated command — so this tier declines it and names the
    // per-invocation flag that does what the exporter wanted.
    const ambient = lintLlmDiff({
      judge,
      cacheDirectory,
      environment: { NX_SKIP_NX_CACHE: "true" },
    });

    expect(ambient.replayed).toBe(true);
    expect(ambient.output).toContain(
      "lint-llm-diff: ignoring the ambient global Nx cache skip",
    );
    expect(ambient.output).toContain("--rejudge");
    expect(judge.invocations()).toHaveLength(1);
  }, 300_000);
});
