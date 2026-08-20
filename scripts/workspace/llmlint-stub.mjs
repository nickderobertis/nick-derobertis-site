#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

// The llmlint `llmlint-cache.spec.ts` stands in for, copied onto PATH under the
// name `llmlint` by the journeys that drive `just lint-llm-diff`.
//
// It answers the three questions the real one is asked by this tier: `--version`
// and `config`, which are what the judged tier fingerprints its cache key with,
// and a judgement, which is everything else. `config` renders `oneharness.bin`
// from the wrapper the caller injected exactly as the real llmlint does — that
// field is why a fingerprint read from the caller's environment hashed one
// judged diff to a different key per dispatch — and renders a rule set a journey
// can move without touching the tree, which is how "a plugin fetched from
// outside this repository changed a rule" is reproduced.
//
// Every judgement is appended to `LLMLINT_STUB_RECORD`, one line per invocation
// with the arguments unit-separated, so "the judge was not asked again" is read
// from what it received rather than inferred from a duration or an exit status.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This is llmlint-cache.spec.ts's
// stand-in for a billed third-party CLI, not shipped behavior: it has no browser
// interface and nothing it does reaches a visitor. It is driven end to end by
// every journey in that spec, through the real `just lint-llm-diff` recipe.

const unitSeparator = String.fromCharCode(31);

/** The rule set this run reports, which is the judge configuration in force. */
function rules() {
  const shifted = process.env.LLMLINT_STUB_SHIFTED_RULES;
  const calls = process.env.LLMLINT_STUB_CONFIG_CALLS;
  if (!shifted || !calls) return process.env.LLMLINT_STUB_RULES ?? "baseline";
  // Every call after the first answers differently, which moves the judge
  // configuration out from under a dispatcher that has already keyed on it.
  const asked = readFileSync(calls, "utf8");
  writeFileSync(calls, `${asked}.`);
  return asked.length > 0
    ? shifted
    : (process.env.LLMLINT_STUB_RULES ?? "baseline");
}

const [question] = process.argv.slice(2);
if (question === "--version") {
  process.stdout.write(
    `${process.env.LLMLINT_STUB_VERSION ?? "llmlint 0.0.0-stub"}\n`,
  );
  process.exit(0);
}
if (question === "config") {
  process.stdout.write(
    `${JSON.stringify({
      config_files: [`${process.cwd()}/llmlint.yml`],
      config: {
        oneharness: { bin: process.env.LLMLINT_ONEHARNESS_BIN ?? null },
        rules: rules(),
      },
    })}\n`,
  );
  process.exit(0);
}

const judged = process.argv.slice(2);
const record = process.env.LLMLINT_STUB_RECORD;
if (!record) {
  process.stderr.write(
    "llmlint stub: LLMLINT_STUB_RECORD names the file each judgement is recorded in; set it and retry\n",
  );
  process.exit(64);
}
appendFileSync(record, `${judged.join(unitSeparator)}${unitSeparator}\n`);
process.stdout.write(`stub judge: judged ${judged.join(" ")}\n`);
process.exit(Number(process.env.LLMLINT_STUB_VERDICT ?? "0"));
