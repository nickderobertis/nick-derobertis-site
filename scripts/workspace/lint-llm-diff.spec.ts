import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";

// `just lint-llm-diff` is the diff-scoped LLM-judge run, and llmlint's trailing
// `[FILES]` positional *replaces the configured file globs*. A path it cannot
// match is not an error: every rule reports "no files matched" and the run exits
// 0. So an argument that lands on FILES instead of on `--diff-base`, or a single
// path that word-splits into two unmatchable ones, shrinks the judged ruleset and
// still reports a pass. These tests drive the real recipe and assert the argv it
// hands over, which is all the recipe decides.
//
// The recipe now dispatches the cached Nx target `tooling-workspace:lint-llm-diff`
// rather than calling llmlint itself, so the base it routes reaches the judge
// resolved to the commit that target's cache key names. What may and may not be
// replayed from that cache is llmlint-cache.spec.ts's subject; what reaches the
// judge at all is this one's.

const workspace = process.cwd();

/** The commit a revision names, which is what the recipe hands the judge. */
const commitOf = (revision: string) =>
  execFileSync("git", ["rev-parse", "--verify", `${revision}^{commit}`], {
    cwd: workspace,
    encoding: "utf8",
  }).trim();

interface Invocation {
  status: number | null;
  stderr: string;
  /** The argv llmlint received, or null when the recipe rejected its input first. */
  argv: string[] | null;
}

/**
 * A cache directory these runs own, so no invocation here reads or writes the
 * contributor's Nx cache. Nx's daemon lives in the data half of it, so the runs
 * go without one rather than start it for a directory about to be discarded.
 */
const cacheDirectory = mkdtempSync(path.join(tmpdir(), "lint-llm-diff-nx-"));
afterAll(() => rmSync(cacheDirectory, { force: true, recursive: true }));

// llmlint: ignore-block[e2e_not_mocked] These tests drive the real `just lint-llm-diff` CLI as a user does; only llmlint, the billed and networked third-party judge downstream of it, is stood in for. Running the real one would spend a model call per case, make a deterministic gate depend on the network, and break `just check` for anyone who has not also run `just setup-llmlint`, which `just bootstrap` does not. The real llmlint is driven by `just lint-llm-diff` itself, which is the gate.
/**
 * Runs the recipe with `llmlint` replaced by a stub that records its arguments
 * NUL-separated, so a recorded argument is exactly the one llmlint received even
 * when it contains whitespace. The stub's exit code stands in for the judge's
 * verdict, which is the recipe's only failure input from llmlint.
 *
 * The stub also answers the two questions the tier fingerprints its cache key
 * with, and answers the second one differently for every invocation. That is
 * what keeps each case below a fresh judgement: without it the second run of one
 * argv would replay the first one's recorded verdict and record no argv at all,
 * which is a passing-looking result arrived at without a judge.
 */
function runLintLlmDiff(args: string[], stubExit = 0): Invocation {
  const stubDir = mkdtempSync(path.join(tmpdir(), "llmlint-stub-"));
  try {
    const argvFile = path.join(stubDir, "argv");
    writeFileSync(
      path.join(stubDir, "llmlint"),
      [
        "#!/usr/bin/env bash",
        'case "$1" in',
        '  --version) echo "llmlint 0.0.0-stub"; exit 0 ;;',
        `  config) printf '{"config_files":["%s/llmlint.yml"],"config":{"probe":"%s"}}\\n' "$PWD" ${JSON.stringify(randomUUID())}; exit 0 ;;`,
        "esac",
        `printf '%s\\0' "$@" >${JSON.stringify(argvFile)}`,
        `exit ${stubExit}`,
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
    const result = spawnSync("just", ["lint-llm-diff", ...args], {
      cwd: workspace,
      encoding: "utf8",
      timeout: 120_000,
      env: {
        // llmlint: ignore[boundary_inputs_validated] What survives the filter is forwarded, never read: `just` and the `pnpm exec nx` it dispatches need the caller's PATH, HOME, and Node resolution to start at all, and nothing here parses, branches on, or interpolates any of it. Every Nx setting is dropped instead of forwarded, and the ones these runs depend on are set below, from a directory the test itself created.
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([name]) => !name.startsWith("NX_"),
          ),
        ),
        NX_CACHE_DIRECTORY: path.join(cacheDirectory, "cache"),
        NX_DAEMON: "false",
        NX_WORKSPACE_DATA_DIRECTORY: path.join(cacheDirectory, "data"),
        PATH: `${stubDir}${path.delimiter}${process.env.PATH ?? ""}`,
      },
    });
    const recorded = existsSync(argvFile)
      ? readFileSync(argvFile, "utf8")
      : null;
    return {
      status: result.status,
      stderr: result.stderr,
      argv:
        recorded === null
          ? null
          : recorded === ""
            ? []
            : recorded.split("\0").slice(0, -1),
    };
  } finally {
    rmSync(stubDir, { recursive: true, force: true });
  }
}
// llmlint: ignore-end[e2e_not_mocked]

// llmlint: ignore-block[tests_mirror_real_usage] The argv llmlint receives is this recipe's own output, and it is the only observable that can prove the routing: a ref sent to FILES instead of `--diff-base` leaves exit status and stdout looking exactly like a clean run, which is how the bug these tests cover survived a real invocation. Every user-visible outcome the recipe does own — exit 0, the two exit 2 rejections and their messages, and the exit 1 the judge's findings cause — is asserted straight off the CLI alongside it.
/** The argv llmlint received, refusing to assert on a run that never got there. */
function judgedArgv({ argv, status, stderr }: Invocation): string[] {
  if (argv === null)
    throw new Error(
      `just lint-llm-diff never reached llmlint (exit ${status}): ${stderr}`,
    );
  return argv;
}

/** Everything llmlint reads as a FILES entry: the argv after the base. */
function fileOverrides(argv: string[]): string[] {
  const base = argv.indexOf("--diff-base");
  if (base === -1) throw new Error("the recipe passed no --diff-base");
  return argv.slice(base + 2);
}

describe("just lint-llm-diff argument routing", () => {
  test("judges the whole configured tree against origin/master by default", () => {
    const invocation = runLintLlmDiff([]);
    const argv = judgedArgv(invocation);

    expect(invocation.status).toBe(0);
    expect(argv).toEqual(["--diff", "--diff-base", commitOf("origin/master")]);
    expect(fileOverrides(argv)).toEqual([]);
  }, 120_000);

  test("routes a passed ref to --diff-base and never to FILES", () => {
    const invocation = runLintLlmDiff(["HEAD~1"]);
    const argv = judgedArgv(invocation);

    expect(invocation.status).toBe(0);
    expect(argv).toEqual(["--diff", "--diff-base", commitOf("HEAD~1")]);
    expect(fileOverrides(argv)).toEqual([]);
  }, 120_000);

  test("accepts a range as the base, resolving both of its endpoints", () => {
    const invocation = runLintLlmDiff(["HEAD~1..HEAD"]);
    const argv = judgedArgv(invocation);

    expect(invocation.status).toBe(0);
    expect(argv).toEqual([
      "--diff",
      "--diff-base",
      `${commitOf("HEAD~1")}..${commitOf("HEAD")}`,
    ]);
  }, 120_000);

  test("rejects unsupported cache flags before invoking the judge", () => {
    const invocation = runLintLlmDiff(["origin/master", "--skip-nx-cache"]);

    expect(invocation.status).toBe(2);
    expect(invocation.argv).toBeNull();
    expect(invocation.stderr).toContain(
      "lint-llm-diff: every file after the base must be an existing workspace path",
    );
    expect(invocation.stderr).toContain("--rejudge");
  }, 120_000);

  test("keeps files available after the base", () => {
    const invocation = runLintLlmDiff([
      "HEAD~1",
      "justfile",
      "scripts/workspace",
    ]);

    expect(judgedArgv(invocation)).toEqual([
      "--diff",
      "--diff-base",
      commitOf("HEAD~1"),
      "justfile",
      "scripts/workspace",
    ]);
    expect(invocation.status).toBe(0);
  }, 120_000);

  test("hands a path containing a space to llmlint as the one file it names", () => {
    // The recipe only forwards paths that exist, so this needs a real one. It
    // goes under the gitignored scratch directory, which Nx does not hash.
    mkdirSync("test-results", { recursive: true });
    const scratch = mkdtempSync(path.join("test-results", "lint-llm-diff-"));
    const spaced = path.join(scratch, "a spaced file.tsx");
    try {
      writeFileSync(spaced, "");
      const invocation = runLintLlmDiff(["HEAD~1", spaced]);

      expect(invocation.status).toBe(0);
      expect(fileOverrides(judgedArgv(invocation))).toEqual([spaced]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 120_000);

  test.each(["no-such-file.ts", "../package.json", "--plan-only"])(
    "refuses to judge anything when a file cannot be matched: %s",
    (file) => {
      const invocation = runLintLlmDiff(["HEAD~1", file]);

      expect(invocation.status).toBe(2);
      expect(invocation.argv).toBeNull();
      expect(invocation.stderr).toContain(
        "lint-llm-diff: every file after the base must be an existing workspace path",
      );
    },
    120_000,
  );

  test.each(["no-such-ref", "--plan-only"])(
    "refuses to judge anything when the base is not a revision: %s",
    (base) => {
      const invocation = runLintLlmDiff([base]);

      expect(invocation.status).toBe(2);
      expect(invocation.argv).toBeNull();
      expect(invocation.stderr).toContain(
        "lint-llm-diff: base must be a git revision to diff against",
      );
    },
    120_000,
  );

  test("fails the recipe with a next action when the judge reports findings", () => {
    const invocation = runLintLlmDiff([], 1);

    expect(invocation.status).toBe(1);
    expect(judgedArgv(invocation)).toEqual([
      "--diff",
      "--diff-base",
      commitOf("origin/master"),
    ]);
    expect(invocation.stderr).toContain(
      "lint-llm-diff: the LLM judge reported the findings above",
    );
  }, 120_000);
});
// llmlint: ignore-end[tests_mirror_real_usage]
