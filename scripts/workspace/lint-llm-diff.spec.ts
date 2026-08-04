import { spawnSync } from "node:child_process";
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
import { describe, expect, test } from "vitest";

// `just lint-llm-diff` is the diff-scoped LLM-judge run, and llmlint's trailing
// `[FILES]` positional *replaces the configured file globs*. A path it cannot
// match is not an error: every rule reports "no files matched" and the run exits
// 0. So an argument that lands on FILES instead of on `--diff-base`, or a single
// path that word-splits into two unmatchable ones, shrinks the judged ruleset and
// still reports a pass. These tests drive the real recipe and assert the argv it
// hands over, which is all the recipe decides.

const DEFAULT_BASE = "origin/master";

interface Invocation {
  status: number | null;
  stderr: string;
  /** The argv llmlint received, or null when the recipe rejected its input first. */
  argv: string[] | null;
}

// llmlint: ignore-block[e2e_not_mocked] These tests drive the real `just lint-llm-diff` CLI as a user does; only llmlint, the billed and networked third-party judge downstream of it, is stood in for. Running the real one would spend a model call per case, make a deterministic gate depend on the network, and break `just check` for anyone who has not also run `just setup-llmlint`, which `just bootstrap` does not. The real llmlint is driven by `just lint-llm-diff` itself, which is the gate.
/**
 * Runs the recipe with `llmlint` replaced by a stub that records its arguments
 * NUL-separated, so a recorded argument is exactly the one llmlint received even
 * when it contains whitespace. The stub's exit code stands in for the judge's
 * verdict, which is the recipe's only failure input from llmlint.
 */
function runLintLlmDiff(args: string[], stubExit = 0): Invocation {
  const stubDir = mkdtempSync(path.join(tmpdir(), "llmlint-stub-"));
  try {
    const argvFile = path.join(stubDir, "argv");
    writeFileSync(
      path.join(stubDir, "llmlint"),
      `#!/usr/bin/env bash\nprintf '%s\\0' "$@" >${JSON.stringify(argvFile)}\nexit ${stubExit}\n`,
      { mode: 0o755 },
    );
    const result = spawnSync("just", ["lint-llm-diff", ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 120_000,
      env: {
        ...process.env,
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
    expect(argv).toEqual(["--diff", "--diff-base", DEFAULT_BASE]);
    expect(fileOverrides(argv)).toEqual([]);
  });

  test("routes a passed ref to --diff-base and never to FILES", () => {
    const invocation = runLintLlmDiff(["HEAD~1"]);
    const argv = judgedArgv(invocation);

    expect(invocation.status).toBe(0);
    expect(argv).toEqual(["--diff", "--diff-base", "HEAD~1"]);
    expect(fileOverrides(argv)).toEqual([]);
  });

  test("accepts a range as the base, which llmlint diffs as given", () => {
    const invocation = runLintLlmDiff(["HEAD~1..HEAD"]);
    const argv = judgedArgv(invocation);

    expect(invocation.status).toBe(0);
    expect(argv).toEqual(["--diff", "--diff-base", "HEAD~1..HEAD"]);
  });

  test("keeps files available after the base", () => {
    const invocation = runLintLlmDiff([
      "HEAD~1",
      "justfile",
      "scripts/workspace",
    ]);

    expect(invocation.status).toBe(0);
    expect(judgedArgv(invocation)).toEqual([
      "--diff",
      "--diff-base",
      "HEAD~1",
      "justfile",
      "scripts/workspace",
    ]);
  });

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
  });

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
  );

  test("fails the recipe with a next action when the judge reports findings", () => {
    const invocation = runLintLlmDiff([], 1);

    expect(invocation.status).toBe(1);
    expect(judgedArgv(invocation)).toEqual([
      "--diff",
      "--diff-base",
      DEFAULT_BASE,
    ]);
    expect(invocation.stderr).toContain(
      "lint-llm-diff: the LLM judge reported the findings above",
    );
  });
});
// llmlint: ignore-end[tests_mirror_real_usage]
