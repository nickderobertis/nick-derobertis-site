import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  fileSeparator,
  JudgeRuntimeError,
  judgeFingerprint,
  repositoryRoot,
} from "./llmlint-runtime.mjs";

// `just lint-llm-diff` — the caller's side of the judged tier: resolve the base
// to the commit the cache key names, resolve the judge configuration it is keyed
// on, dispatch the cached Nx target, and report one status line. What that key
// has to cover, and why, is `scripts/AGENTS.md`.
//
// A green says one line, the way every other recipe here reports; a run that has
// to be cleared keeps every byte Nx and the judge produced.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This developer CLI has no
// browser interface: it judges a diff and reports an exit status, so nothing it
// does is observable to a visitor. lint-llm-diff.spec.ts drives the real recipe
// through the argv it hands the judge and both of its rejected-input paths, and
// llmlint-cache.spec.ts drives it through real Nx.

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
const judgedBase = range
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
// Reported as part of this run's one status line rather than beside it: the
// caller asked for something this tier declined, and a green here says one line.
const declined =
  process.env.NX_SKIP_NX_CACHE || process.env.NX_DISABLE_NX_CACHE
    ? " [ignoring the ambient global Nx cache skip, which would re-roll this non-deterministic judge from every unrelated command; force one fresh judgement of this tier alone with --rejudge]"
    : "";

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
      LLMLINT_DIFF_BASE: judgedBase,
      LLMLINT_DIFF_FILES: files.join(fileSeparator),
      LLMLINT_JUDGE_FINGERPRINT: fingerprint,
      NX_SKIP_LOG_GROUPING: "true",
    },
    stdio: ["inherit", "pipe", "pipe"],
  },
);

// Kept rather than streamed, the way every other recipe here reports: a green
// says one line — which verdict this is and what base it is a verdict about —
// and a run that has to be cleared keeps every byte Nx and the judge produced.
let reported = "";
for (const stream of [nx.stdout, nx.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    reported += chunk;
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
  const provenance = replayed.some((note) => printed.includes(note))
    ? `lint-llm-diff: replayed the recorded verdict for base ${judgedBase} (Nx cache hit)${declined}`
    : `lint-llm-diff: judged this diff against base ${judgedBase} (Nx cache miss)${declined}`;
  if (status === 0) {
    console.log(provenance);
    process.exit(0);
  }
  process.stderr.write(reported);
  console.error(provenance);
  // The judge names its own verdict, so a failure that carries neither name is
  // one the judge never got to — Nx, pnpm, or the target's own configuration —
  // and is reported as that rather than as findings to go and clear.
  if (!/^lint-llm-diff: the judge (reported|never reached)/m.test(printed))
    console.error(
      `lint-llm-diff: the judged tier failed before the judge could answer, so no verdict was reached or recorded; fix the Nx or pnpm error above — 'just bootstrap' if the workspace is not installed — then rerun just lint-llm-diff ${named}`,
    );
  process.exit(status ?? 1);
});
