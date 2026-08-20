import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  fileSeparator,
  JudgeRuntimeError,
  judgeFingerprint,
  repositoryRoot,
} from "./llmlint-runtime.mjs";

// `just lint-llm-diff` — the diff-scoped LLM-judge tier, dispatched as the cached
// Nx target `tooling-workspace:lint-llm-diff` rather than as a bare judge call.
//
// The judge is non-deterministic, so every bare invocation over one diff took an
// independent sample: four rolls over one branch named four different verdicts,
// and fixing the rule one roll reported only changed which rule the next one
// failed. What this file does is turn one judged diff into one cache key, so an
// unchanged tree judged against an unchanged base under an unchanged judge
// replays that run's own report instead of rolling again.
//
// Three things decide the key, and each is resolved here, before Nx hashes it:
//
//   * the whole workspace, through the target's `wholeWorkspace` input;
//   * the base, resolved to a commit — a symbolic ref would change meaning under
//     one key, so a verdict recorded against yesterday's `origin/master` would
//     replay for today's;
//   * the judge configuration in force, as `llmlint-fingerprint.mjs` resolves it
//     in the judge's own environment rather than this caller's.
//
// That fingerprint is computed here rather than declared as an Nx `runtime`
// input on purpose. Nx scores a runtime input that exits non-zero as *no
// contribution* rather than as an error, so a fingerprint the environment can
// break would not fail the tier — it would quietly drop the judge configuration
// out of the key. Computed on this side of the dispatch, a fingerprint that
// cannot be resolved refuses the run instead.
//
// Only a green is cached, because Nx caches successful tasks only: findings and
// a toolchain that never reached a verdict both re-judge next time. A wrong
// green sticks until the tree, the base commit, or the judge configuration
// moves, so `just lint-llm-diff <base> --rejudge` forces one fresh judgement.
// It is deliberately per-invocation: an ambient `NX_SKIP_NX_CACHE` exported to
// re-judge this tier would re-roll it from every unrelated command, so this tier
// reports and ignores that one, and every other Nx target still honours it.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This developer CLI has no
// browser interface: it judges a diff and reports an exit status, so nothing it
// does is observable to a visitor. lint-llm-diff.spec.ts drives the real recipe
// through the argv it hands the judge and both of its rejected-input paths, and
// llmlint-cache.spec.ts drives it through real Nx for a judged run, a replayed
// one, two callers over one tree, a changed judge configuration, an unresolvable
// fingerprint, and the verdicts that are deliberately never cached.

const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function refuse(message, status = 2) {
  console.error(`lint-llm-diff: ${message}`);
  process.exit(status);
}

const argv = process.argv.slice(2);
const rejudge = argv.includes("--rejudge");
const [base = "", ...files] = argv.filter((entry) => entry !== "--rejudge");

/**
 * The base a lifecycle dispatch already named, so a worker's gate and the
 * publishing push that follows it judge one diff and share one recorded verdict.
 * Rediscovering a default instead would let the push resolve a different base,
 * roll the judge again, and land work whose own gate had reported findings.
 */
function comparisonBase() {
  const remote = process.env.ONEVCS_COMPARISON_REMOTE || "origin";
  const branch = process.env.ONEVCS_COMPARISON_BASE || "master";
  return `${remote}/${branch}`;
}

const named = base || comparisonBase();
if (named.startsWith("-"))
  refuse(
    "base must be a git revision to diff against, such as origin/master, HEAD~1, or a range; fetch the missing ref, then rerun just lint-llm-diff <base>",
  );

/** One revision, resolved to the commit the cache key names. */
function commitOf(revision) {
  // llmlint: ignore[boundary_inputs_validated] `revision` was refused above if it could be read as an option, and it is passed as one argv entry to a spawn with no shell; git itself is the boundary that decides whether it names a commit, and a rejection is reported rather than interpreted.
  const printed = spawnSync(
    "git",
    [
      "-C",
      repositoryRoot,
      "rev-parse",
      "--verify",
      "--quiet",
      `${revision}^{commit}`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (printed.status !== 0 || !/^[0-9a-f]{40}$/.test(printed.stdout.trim()))
    refuse(
      "base must be a git revision to diff against, such as origin/master, HEAD~1, or a range; fetch the missing ref, then rerun just lint-llm-diff <base>",
    );
  return printed.stdout.trim();
}

// A range keys on both of its endpoints for the same reason a single ref keys on
// one: `HEAD~1..HEAD` names a different diff after every commit.
const range = /^(.+?)(\.{2,3})(.+)$/.exec(named);
const baseSha = range
  ? `${commitOf(range[1])}${range[2]}${commitOf(range[3])}`
  : commitOf(named);

for (const file of files) {
  const inside =
    !isAbsolute(file) &&
    resolve(repositoryRoot, file).startsWith(`${repositoryRoot}/`);
  if (
    file.startsWith("-") ||
    file.includes(fileSeparator) ||
    !inside ||
    !existsSync(resolve(repositoryRoot, file))
  )
    refuse(
      `every file after the base must be an existing workspace path, because llmlint reports a clean run for a path it cannot match; correct or drop "${file}", then rerun just lint-llm-diff <base> <files> (to force one fresh judgement instead, pass --rejudge)`,
    );
}

let fingerprint;
try {
  fingerprint = judgeFingerprint();
} catch (error) {
  if (!(error instanceof JudgeRuntimeError)) throw error;
  refuse(
    `the judge configuration could not be fingerprinted, so this run could not be keyed on it and was not judged: ${error.message}`,
    1,
  );
}

const environment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => name !== "NX_SKIP_NX_CACHE" && name !== "NX_DISABLE_NX_CACHE",
  ),
);
if (process.env.NX_SKIP_NX_CACHE || process.env.NX_DISABLE_NX_CACHE)
  console.error(
    `lint-llm-diff: ignoring the ambient global Nx cache skip, which would re-roll this non-deterministic judge from every unrelated command; force a fresh judgement of this tier alone with 'just lint-llm-diff ${named} --rejudge'`,
  );

// Nx reports a replay two ways, and only the per-task note is safe at any size:
// Nx replays a cache hit as one burst, so a replayed report larger than a pipe
// buffer can arrive with its trailing summary cut off. Both are matched so an Nx
// that prints only one of them still reports the verdict's provenance honestly.
const replayed = [
  "Nx read the output from the cache instead of running the command",
  "[existing outputs match the cache, left as is]",
  "[local cache]",
  "[remote cache]",
];

// llmlint: ignore[boundary_inputs_validated] Every value handed over was validated above — the base resolved to commits by git, each file to an existing path inside this repository, the fingerprint to what llmlint itself reported — and the inherited environment is forwarded rather than read, with the two ambient cache switches this tier refuses already dropped.
const nx = spawn(
  "pnpm",
  [
    "exec",
    "nx",
    "run",
    "tooling-workspace:lint-llm-diff",
    ...(rejudge ? ["--skip-nx-cache"] : []),
  ],
  {
    cwd: repositoryRoot,
    env: {
      ...environment,
      LLMLINT_DIFF_BASE_SHA: baseSha,
      LLMLINT_DIFF_FILES: files.join(fileSeparator),
      LLMLINT_JUDGE_FINGERPRINT: fingerprint,
      NX_SKIP_LOG_GROUPING: "true",
    },
    stdio: ["inherit", "pipe", "pipe"],
  },
);

// Streamed through rather than captured and replayed at the end: a fresh
// judgement takes minutes, and a caller watching a silent pipe cannot tell it
// from a hang. What is accumulated alongside is only read for the provenance
// line below.
let reported = "";
for (const [stream, sink] of [
  [nx.stdout, process.stdout],
  [nx.stderr, process.stderr],
]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    reported += chunk;
    sink.write(chunk);
  });
}

nx.on("error", (error) =>
  refuse(
    `Nx could not be started (${error.message}); run 'just bootstrap' and retry`,
    1,
  ),
);
nx.on("close", (status) => {
  const printed = reported.replace(ansi, "");
  console.error(
    replayed.some((note) => printed.includes(note))
      ? `lint-llm-diff: replayed the recorded verdict for base ${baseSha} (Nx cache hit)`
      : `lint-llm-diff: judged this diff against base ${baseSha} (Nx cache miss)`,
  );
  const unanswered = printed.includes(
    "lint-llm-diff: the judge never reached a verdict",
  );
  if (status !== 0 && !unanswered)
    console.error(
      "lint-llm-diff: the LLM judge reported the findings above; fix each one, or justify it with a narrow ignore directive at its site, then rerun just lint-llm-diff",
    );
  process.exit(status ?? 1);
});
