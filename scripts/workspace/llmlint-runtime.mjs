import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// One source for the environment this repository's LLM-judge tier judges under,
// and for the fingerprint that keys its cache on that environment.
//
// Both ends of the cached `tooling-workspace:lint-llm-diff` target load this:
// `lint-llm-diff.mjs`, which computes the fingerprint and dispatches Nx, and
// `llmlint-judge.mjs`, which is the target's body. That sharing is the point.
// The judge is non-deterministic, so a recorded verdict is only replayable when
// every caller of one tree and one base arrives at the same key — and
// `llmlint config` renders values that vary by caller rather than by what is
// judged. Resolving them here, once, is what keeps one judged diff on one key.

/** The repository, resolved from this file so no caller's cwd can decide it. */
export const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** A judge runtime that could not be resolved, reported rather than hashed. */
export class JudgeRuntimeError extends Error {
  name = "JudgeRuntimeError";
}

// This tier's own dispatch plumbing, dropped before llmlint is asked anything.
// `LLMLINT_DIFF_*` and `LLMLINT_JUDGE_*` are set by the dispatcher and read back
// inside the Nx target, so each is present on one end and absent on the other;
// `NX_*` is injected by Nx into the target and by nothing into the dispatcher.
// Keeping either would let the two ends describe different environments.
const dispatchPlumbing = /^(?:NX_|LLMLINT_(?:DIFF|JUDGE)_)/;

/**
 * The environment llmlint runs under, for judging and for fingerprinting alike.
 *
 * Everything else the caller exports is kept rather than replaced: llmlint is
 * installed outside the checkout by `just setup-llmlint`, and its harness reads
 * the credentials and `ONEHARNESS_*` selections the session exports, so
 * narrowing this further would leave the judge unable to run at all.
 */
export function judgeEnvironment(caller = process.env) {
  return Object.fromEntries(
    Object.entries(caller).filter(([name]) => !dispatchPlumbing.test(name)),
  );
}

const reason = (error) =>
  error instanceof Error ? error.message : String(error);

/**
 * llmlint's own answer to a question, asked in the judge's environment from the
 * repository root — which is where llmlint discovers `llmlint.yml`.
 *
 * llmlint: ignore[boundary_inputs_validated] Nothing here crosses a trust
 * boundary: `question` is one of two literal argument lists this module names,
 * and the environment is forwarded rather than read — no value in it is parsed,
 * branched on, or interpolated. What llmlint answers *is* validated, at the one
 * place it is read into a decision, by `judgeConfig` below.
 */
function ask(question, environment) {
  return execFileSync("llmlint", question, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: environment,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// `llmlint config` prints the effective merged configuration — this repository's
// `llmlint.yml` plus every pinned plugin's resolved rules — so one hash covers a
// rule change in a plugin fetched from outside this repository, which no tracked
// file records. Only the two fields this module folds out are named; the schema
// is loose everywhere so that reserializing it drops nothing a stricter one
// would have silently stripped out of the key.
const judgeConfig = z.looseObject({
  config_files: z.array(z.string()).min(1),
  config: z.looseObject({
    oneharness: z.looseObject({ bin: z.string().nullish() }).nullish(),
  }),
});

/**
 * What the dispatcher's checkout path is replaced with before hashing.
 *
 * `oneharness.bin` names the wrapper the *dispatcher* injected through
 * `LLMLINT_ONEHARNESS_BIN`, not anything this repository declares: an
 * orchestrator that dispatches work here points it at its own checkout, and a
 * contributor sets it at all. Left in the key, one judged diff hashed
 * differently per dispatch and the non-deterministic judge re-rolled every time.
 * This repository ships no wrapper of its own to pin it to, so the value is
 * folded out instead — and nothing is lost by it, because the harness and model
 * this repository actually selects are declared in the tracked `oneharness.toml`
 * that the target's whole-workspace input already covers.
 */
const dispatcherWrapper = "{dispatcher-oneharness-bin}";

/** Every string beneath a value, with the checkout's own path folded out. */
function foldOutCheckoutPath(value, root) {
  if (typeof value === "string") return value.split(root).join("{root}");
  if (Array.isArray(value))
    return value.map((entry) => foldOutCheckoutPath(entry, root));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([name, entry]) => [
        name,
        foldOutCheckoutPath(entry, root),
      ]),
    );
  return value;
}

/**
 * The judge configuration in force, as the bytes this tier's cache key covers.
 *
 * Key order is preserved rather than sorted: llmlint batches its rules in the
 * order it merged them, so a reordering is a change in what the judge is asked.
 */
function canonicalJudgeConfig(printed, caller) {
  let parsed;
  try {
    parsed = judgeConfig.parse(JSON.parse(printed));
  } catch (error) {
    throw new JudgeRuntimeError(
      `'llmlint config' did not print the effective configuration this tier keys on (${reason(error)}); run 'just lint-llm-validate' to repair llmlint.yml or its plugin pins, then retry`,
    );
  }
  const canonical = foldOutCheckoutPath(parsed, repositoryRoot);
  // Unconditional, including the null a caller who injected nothing renders:
  // "a dispatcher was present" is caller identity too, and a key that told the
  // two apart would stop a worker's cleared verdict from replaying for the
  // publishing push that follows it, which is the whole point of keying this.
  if (canonical.config.oneharness)
    canonical.config.oneharness.bin = dispatcherWrapper;
  const text = JSON.stringify(canonical);
  // The fold is verified rather than assumed. An llmlint that renders the
  // dispatcher's wrapper somewhere else too would split this key silently —
  // exactly the failure this whole module exists to prevent — so it is named.
  const injected = caller.LLMLINT_ONEHARNESS_BIN;
  if (injected && text.includes(injected))
    throw new JudgeRuntimeError(
      `'llmlint config' renders the dispatcher's oneharness wrapper (${injected}) outside oneharness.bin, so this fingerprint would differ per caller; teach scripts/workspace/llmlint-runtime.mjs to fold the new field out, then retry`,
    );
  return text;
}

/**
 * A digest of the judge configuration in force: the installed llmlint version
 * plus the effective merged config, both resolved in the judge's environment.
 *
 * This is the answer to "why did the cache miss when nothing in the tree
 * changed?" — run `node scripts/workspace/llmlint-fingerprint.mjs` to see it. A
 * changed fingerprint over an unchanged tree is a changed judge, not a changed
 * diff. It throws rather than returning a placeholder, because a fingerprint
 * that silently dropped out of the key would replay a verdict the configuration
 * has moved on from; every caller reports that failure instead of judging.
 */
export function judgeFingerprint(caller = process.env) {
  const environment = judgeEnvironment(caller);
  let version;
  try {
    version = ask(["--version"], environment).trim();
  } catch (error) {
    throw new JudgeRuntimeError(
      `'llmlint --version' failed (${reason(error)}); run 'just setup-llmlint' and retry`,
    );
  }
  let printed;
  try {
    printed = ask(["config"], environment);
  } catch (error) {
    throw new JudgeRuntimeError(
      `'llmlint config' failed (${reason(error)}); repair llmlint.yml or its plugin pins and retry`,
    );
  }
  return createHash("sha256")
    .update(`${version}\n${canonicalJudgeConfig(printed, caller)}\n`)
    .digest("hex");
}

/**
 * A base this tier may key on: one resolved commit, or the two endpoints of a
 * resolved range. A symbolic ref is refused rather than accepted, because it
 * would change meaning under one key — `origin/master` names a different diff
 * the moment the base advances, and a verdict recorded against the old one
 * would replay for the new.
 */
export const resolvedBase = /^[0-9a-f]{40}(?:\.{2,3}[0-9a-f]{40})?$/;

/** The separator both ends encode `LLMLINT_DIFF_FILES` with. */
export const fileSeparator = "\n";

/**
 * The paths a narrowed run judges, decoded from `LLMLINT_DIFF_FILES`.
 *
 * llmlint's trailing `FILES` positional *replaces* the configured globs, and a
 * path it cannot match is a silent exit 0 — so a narrowed green is a claim about
 * a fraction of the ruleset. That narrowing is therefore part of the cache key
 * rather than an argument beside it: a green over one path can only ever replay
 * for that same path, never for the whole tree.
 */
export function judgedFiles(encoded) {
  return encoded ? encoded.split(fileSeparator) : [];
}
