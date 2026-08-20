import { JudgeRuntimeError, judgeFingerprint } from "./llmlint-runtime.mjs";

// Print the fingerprint of the judge configuration in force. Run it by hand
// when a cache miss is unexplained: a changed fingerprint over an unchanged tree
// is a changed judge, not a changed diff.
//
// It is a command that fails rather than an Nx `runtime` input, which is the one
// thing about this file `scripts/AGENTS.md` explains and this comment does not
// repeat.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This developer CLI has no
// browser interface: it prints a digest and exits, so nothing it does is
// observable to a visitor. llmlint-cache.spec.ts drives it through the real
// `just lint-llm-diff` recipe, including the fingerprint that cannot be
// computed at all.
try {
  process.stdout.write(`${judgeFingerprint()}\n`);
} catch (error) {
  if (!(error instanceof JudgeRuntimeError)) throw error;
  console.error(`llmlint-fingerprint: ${error.message}`);
  process.exit(1);
}
