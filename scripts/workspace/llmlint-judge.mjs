import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  JudgeRuntimeError,
  judgedFiles,
  judgeEnvironment,
  judgeFingerprint,
  repositoryRoot,
  resolvedBase,
} from "./llmlint-runtime.mjs";

// The body of the cached Nx `tooling-workspace:lint-llm-diff` target: judge one
// diff, against one resolved base commit, under this repository's judge runtime.
// Run it through `just lint-llm-diff <base>`, which resolves that base and keys
// the cache on it.
//
// Nothing here records or replays a verdict. llmlint runs, its report is this
// task's terminal output, and its exit status is this task's exit status — so Nx
// replays a clean run's report verbatim, while a run that reported findings
// (exit 1) and one that never reached a verdict (exit >= 2) both stay uncached
// and re-judge next time, deliberately. A branch working through a red pays a
// fresh roll each time; only a green sticks.
//
// Every input arrives as an environment value rather than an argument because Nx
// hashes declared environment variables and does not hash target arguments:
// keying and judging on the same values is what stops a verdict computed against
// one base, or over one narrowed file list, from being replayed for another.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This judged tier has no browser
// interface: it reads a diff and reports an exit status, so nothing it does is
// observable to a visitor. llmlint-cache.spec.ts drives it through the real
// `just lint-llm-diff` recipe and real Nx — judged, replayed, re-judged after a
// judge-configuration change, and refusing every input this file rejects.

function refuse(message) {
  console.error(`lint-llm-diff: ${message}`);
  process.exit(2);
}

const baseSha = process.env.LLMLINT_DIFF_BASE_SHA ?? "";
if (!resolvedBase.test(baseSha))
  refuse(
    `LLMLINT_DIFF_BASE_SHA must be a resolved commit id, or two joined by a range operator, not '${baseSha}'; run 'just lint-llm-diff <base>' rather than this target directly`,
  );
for (const endpoint of baseSha.split(/\.{2,3}/)) {
  // llmlint: ignore[boundary_inputs_validated] `endpoint` reached here only by matching the 40-hex `resolvedBase` pattern above, and it is passed as one argv entry to a spawn with no shell, so there is nothing left for a second opinion here to narrow.
  const found = spawnSync(
    "git",
    [
      "-C",
      repositoryRoot,
      "rev-parse",
      "--verify",
      "--quiet",
      `${endpoint}^{commit}`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (found.status !== 0)
    refuse(
      `base commit '${endpoint}' is missing from this checkout; fetch it and retry`,
    );
}

// The dispatcher computed this before Nx hashed it, so holding it to what the
// judge's own environment resolves is what makes the key describe the judge
// rather than the caller. A mismatch fails the task, so no verdict reached under
// a disagreed-on judge configuration is ever recorded.
const declared = process.env.LLMLINT_JUDGE_FINGERPRINT ?? "";
if (!/^[0-9a-f]{64}$/.test(declared))
  refuse(
    "LLMLINT_JUDGE_FINGERPRINT must be the judge fingerprint this tier is keyed on; run 'just lint-llm-diff <base>' rather than this target directly",
  );
let resolved;
try {
  resolved = judgeFingerprint();
} catch (error) {
  if (!(error instanceof JudgeRuntimeError)) throw error;
  refuse(
    `the judge configuration this target would judge under could not be resolved, so its verdict could not be keyed on one: ${error.message}`,
  );
}
if (resolved !== declared)
  refuse(
    `the judge configuration changed between keying this run (${declared}) and running it (${resolved}); rerun 'just lint-llm-diff <base>'`,
  );

const files = judgedFiles(process.env.LLMLINT_DIFF_FILES);
for (const file of files) {
  const inside =
    !isAbsolute(file) &&
    resolve(repositoryRoot, file).startsWith(`${repositoryRoot}/`);
  if (
    file.startsWith("-") ||
    !inside ||
    !existsSync(resolve(repositoryRoot, file))
  )
    refuse(
      `every judged file must be an existing path inside this repository, because llmlint reports a clean run for a path it cannot match; correct or drop "${file}", then rerun 'just lint-llm-diff <base> <files>'`,
    );
}

// llmlint's own exit status is this task's, which is exactly the record-keeping
// this tier delegates to Nx: Nx caches a task only when it succeeded.
// llmlint: ignore[boundary_inputs_validated] Every value forwarded here was validated above — the base against `resolvedBase`, each file against this repository's tree — and the environment is forwarded rather than read, with this tier's own dispatch plumbing already dropped by `judgeEnvironment`.
const judged = spawnSync(
  "llmlint",
  ["--diff", "--diff-base", baseSha, ...files],
  {
    cwd: repositoryRoot,
    env: judgeEnvironment(),
    stdio: "inherit",
  },
);
if (judged.error)
  refuse(
    `the judge could not be started (${judged.error.message}); run 'just setup-llmlint' and retry`,
  );
const status = judged.status ?? 2;
// llmlint answers findings with 1 and a toolchain that never reached a verdict
// with 2 or more, and Nx collapses both to one failing status on its way out. It
// is said here, where the difference is still known, so the dispatcher reports a
// judge that could not answer as that rather than as findings to go clear.
if (status >= 2)
  console.error(
    `lint-llm-diff: the judge never reached a verdict (llmlint exited ${status}); its diagnostics are above, nothing was recorded, and the next run judges this diff again`,
  );
process.exit(status);
