import { spawnSync } from "node:child_process";
import { constants } from "node:os";
import {
  isJudgeablePath,
  JudgeRuntimeError,
  judgedFiles,
  judgeEnvironment,
  judgeFingerprint,
  repositoryRoot,
  resolvedBasePattern,
} from "./llmlint-runtime.mjs";

// The body of the cached Nx `tooling-workspace:lint-llm-diff` target. Run it
// through `just lint-llm-diff <base>`, never directly: every input arrives as an
// environment value because Nx hashes those and does not hash target arguments,
// so this refuses anything it was not keyed on.
//
// It records nothing. llmlint runs, its report is this task's output and its
// exit status is this task's status, and Nx does the rest — see
// `scripts/workspace/AGENTS.md`.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This judged tier has no browser
// interface: it reads a diff and reports an exit status, so nothing it does is
// observable to a visitor. llmlint-cache.spec.ts drives it through the real
// `just lint-llm-diff` recipe and real Nx, including every input it refuses.

function refuse(message) {
  console.error(`lint-llm-diff: ${message}`);
  process.exit(2);
}

const judgedBase = process.env.LLMLINT_DIFF_BASE ?? "";
if (!resolvedBasePattern.test(judgedBase))
  refuse(
    `LLMLINT_DIFF_BASE must be a resolved commit id, or two joined by a range operator, not '${judgedBase}'; run 'just lint-llm-diff <base>' rather than this target directly`,
  );
for (const endpoint of judgedBase.split(/\.{2,3}/)) {
  // llmlint: ignore[boundary_inputs_validated] `endpoint` reached here only by matching the 40-hex `resolvedBasePattern` above, and it is passed as one argv entry to a spawn with no shell, so there is nothing left for a second opinion here to narrow.
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
  if (!isJudgeablePath(file))
    refuse(
      `every judged file must be an existing path inside this repository, because llmlint reports a clean run for a path it cannot match; correct or drop "${file}", then rerun 'just lint-llm-diff <base> <files>'`,
    );
}

// llmlint's own exit status is this task's, which is exactly the record-keeping
// this tier delegates to Nx: Nx caches a task only when it succeeded. Its report
// is kept for a failure and dropped for a pass, the way every other tooling
// target here reports: a green says nothing, and the run that has to be cleared
// keeps every diagnostic byte. Nothing is lost to the cache by that — Nx never
// records a failing task, so a failure always streams out freshly judged.
// llmlint: ignore[boundary_inputs_validated] Every value forwarded here was validated above — the base against `resolvedBasePattern`, each file against this repository's tree — and the environment is forwarded rather than read, with this tier's own dispatch plumbing already dropped by `judgeEnvironment`.
const judged = spawnSync(
  "llmlint",
  ["--diff", "--diff-base", judgedBase, ...files],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: judgeEnvironment(),
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
if (judged.error)
  refuse(
    `the judge could not be started (${judged.error.message}); run 'just setup-llmlint' and retry`,
  );
// A judge the host killed reported nothing at all: `spawnSync` gives it no exit
// status, and reading that absence as llmlint's own "the toolchain stopped"
// status invents a cause and sends a reader to repair a judge that was working.
// The signal is the cause, so it is what gets named, and it exits the way a
// shell reports one — 128 plus the signal number — so nothing downstream reads
// this run as a verdict either.
if (judged.signal) {
  process.stderr.write(`${judged.stdout ?? ""}${judged.stderr ?? ""}`);
  console.error(
    `lint-llm-diff: the judge never reached a verdict (llmlint was terminated by ${judged.signal} rather than exiting); this is the host stopping the process, not the judge reporting anything, and an unasked-for SIGKILL is most often the out-of-memory killer — check the host, then rerun just lint-llm-diff. Nothing was recorded, so that run judges this diff again`,
  );
  process.exit(128 + (constants.signals[judged.signal] ?? 0));
}
const status = judged.status ?? 2;
if (status !== 0)
  process.stderr.write(`${judged.stdout ?? ""}${judged.stderr ?? ""}`);
// llmlint answers findings with 1 and a toolchain that never reached a verdict
// with 2 or more, and Nx collapses both to one failing status on its way out.
// The verdict is named here, where the difference is still known, so a failure
// carrying neither name is one the judge never got to and the dispatcher says
// so rather than sending a reader to clear findings that do not exist.
if (status === 1)
  console.error(
    "lint-llm-diff: the judge reported the findings above; fix each one, or justify it with a narrow ignore directive at its site, then rerun just lint-llm-diff",
  );
else if (status >= 2)
  console.error(
    `lint-llm-diff: the judge never reached a verdict (llmlint exited ${status}); repair what its diagnostics above name — 'just setup-llmlint' if the judge itself is missing or stale, 'llmlint doctor' if its harness or credentials are — then rerun just lint-llm-diff. Nothing was recorded, so that run judges this diff again`,
  );
process.exit(status);
