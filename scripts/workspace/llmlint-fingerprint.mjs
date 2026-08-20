import { JudgeRuntimeError, judgeFingerprint } from "./llmlint-runtime.mjs";

// Print the fingerprint of the judge configuration in force — the installed
// llmlint version plus the effective merged config, resolved in the environment
// the judged tier judges under.
//
// `lint-llm-diff.mjs` runs this to key `tooling-workspace:lint-llm-diff` before
// it dispatches Nx, and `llmlint-judge.mjs` runs it inside that target to hold
// the dispatcher's answer to the judge's own environment. Run it by hand when a
// miss is unexplained: a changed fingerprint over an unchanged tree is a changed
// judge, not a changed diff.
//
// This is deliberately a command that fails rather than an Nx `runtime` input.
// Nx scores a runtime input that exits non-zero as *no contribution* rather than
// as an error, so a fingerprint the environment can break would not fail the
// tier — it would silently drop the judge configuration out of the key and
// replay a verdict that configuration has moved on from. Computing it on the
// caller's side of the dispatch, where a failure is an exit status, makes that
// impossible instead of merely loud.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This developer CLI has no
// browser interface: it prints a digest and exits, so nothing it does is
// observable to a visitor. llmlint-cache.spec.ts drives it through the real
// `just lint-llm-diff` recipe — a judged run, a replayed one, a judge
// configuration that changed underneath an unchanged tree, and a fingerprint
// that cannot be computed at all.
try {
  process.stdout.write(`${judgeFingerprint()}\n`);
} catch (error) {
  if (!(error instanceof JudgeRuntimeError)) throw error;
  console.error(`llmlint-fingerprint: ${error.message}`);
  process.exit(1);
}
