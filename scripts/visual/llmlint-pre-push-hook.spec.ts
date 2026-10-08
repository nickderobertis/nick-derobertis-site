import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

// .githooks/pre-push runs `llmlint validate` — the model-free static gate CI's
// llmlint job runs first — before the screencomp visual guard. Without llmlint
// it says so and skips; with it, a failing validate refuses the push, but only
// after the visual guard has run and reached its own verdict, so neither check
// hides the other.
//
// Every test runs the real hook the way git runs it: a subprocess in a real
// clone, with the push refs on stdin. The installed path uses the real llmlint
// against the clone's own llmlint.yml; the missing path removes llmlint from
// PATH and nothing else.

const HOOK = path.resolve(".githooks/pre-push");
const REPO = process.cwd();
const SUBPROCESS_HOME = process.env.HOME;
if (SUBPROCESS_HOME === undefined || SUBPROCESS_HOME === "") {
  throw new Error("llmlint pre-push tests require HOME to resolve llmlint");
}
const IDENTITY = [
  "-c",
  "user.email=guard@example.invalid",
  "-c",
  "user.name=guard",
];
// A screenshot-relevant source path, so the visual guard has something to
// evaluate and announces its verdict rather than passing silently.
const VISUAL_SOURCE = "apps/courses/src/page.tsx";
const GUARD_RAN = "could NOT evaluate this push";

// The workspace's node_modules/.bin would let the uninstalled clone resolve
// this repository's nx, so it is stripped, as in visual-guard-hook.spec.ts.
// llmlint: ignore[boundary_inputs_validated] PATH is test-runner infrastructure, not product input; entries are kept only to resolve the real git, bash, node, pnpm, screencomp, and llmlint subprocesses.
const BASE_PATH = (process.env.PATH ?? "")
  .split(path.delimiter)
  .filter(
    (entry) =>
      entry !== "" &&
      !path.resolve(entry).startsWith(path.join(REPO, "node_modules")),
  );

const llmlintInstalled =
  spawnSync("llmlint", ["--version"], { encoding: "utf8" }).status === 0;

let root: string;
let clone: string;
let visualBase: string;
let visualHead: string;
let staleHead: string;
let withoutLlmlintPath: string;

function inClone(...args: string[]): string {
  return execFileSync("git", ["-C", clone, ...args], {
    encoding: "utf8",
    input: "",
  }).trim();
}

function commitFile(file: string, contents: string, message: string): string {
  writeFileSync(path.join(clone, file), contents);
  inClone("add", file);
  inClone(...IDENTITY, "commit", "-q", "-m", message);
  return inClone("rev-parse", "HEAD");
}

// The same PATH with llmlint absent: each directory holding an `llmlint` is
// replaced by a mirror of every other entry in it, so every other tool the hook
// needs still resolves to the real binary.
function pathWithout(binary: string): string {
  return BASE_PATH.map((entry, index) => {
    if (!existsSync(path.join(entry, binary))) return entry;
    const mirror = path.join(root, `path-${index}`);
    mkdirSync(mirror);
    for (const name of readdirSync(entry)) {
      if (name !== binary) {
        symlinkSync(path.join(entry, name), path.join(mirror, name));
      }
    }
    return mirror;
  }).join(path.delimiter);
}

function runHook(head: string, base: string, PATH: string) {
  return spawnSync("bash", [HOOK, "origin", "https://example.invalid/r.git"], {
    cwd: clone,
    encoding: "utf8",
    input: `refs/heads/probe ${head} refs/heads/probe ${base}\n`,
    env: { HOME: SUBPROCESS_HOME, CI: "", PATH },
  });
}

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "pre-push-llmlint-"));
  clone = path.join(root, "clone");
  execFileSync("git", [
    "clone",
    "-q",
    "--shared",
    "--no-checkout",
    REPO,
    clone,
  ]);
  execFileSync("git", [
    "-C",
    clone,
    "checkout",
    "-q",
    "--detach",
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  ]);
  visualBase = inClone("rev-parse", "HEAD");
  visualHead = commitFile(
    VISUAL_SOURCE,
    `${readFileSync(path.join(clone, VISUAL_SOURCE), "utf8")}// hook fixture\n`,
    "fix(courses): a screenshot-relevant change",
  );
  // A suppression naming a rule llmlint.yml does not configure: the stale
  // directive `llmlint validate` exists to catch. It is assembled at runtime so
  // this file does not itself carry the directive validate would reject.
  staleHead = commitFile(
    "STALE_SUPPRESSION.md",
    `<!-- ${"llmlint"}: ignore[no_such_rule] this rule does not exist -->\nText.\n`,
    "docs: a stale suppression",
  );
  // The hook validates the checked-out tree, so tests start from the one
  // without the stale directive and check it out only where it is the subject.
  inClone("checkout", "-q", "--detach", visualHead);
  withoutLlmlintPath = pathWithout("llmlint");
});

afterAll(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("llmlint validate in the pre-push hook", () => {
  test("without llmlint it says validate was skipped and the visual guard still runs", () => {
    const run = runHook(staleHead, visualBase, withoutLlmlintPath);

    expect(run.stderr).toContain(
      "pre-push: llmlint is not installed, so 'llmlint validate' was skipped",
    );
    expect(run.stderr).toContain("just setup-llmlint");
    expect(run.stderr.indexOf(GUARD_RAN)).toBeGreaterThan(
      run.stderr.indexOf("llmlint is not installed"),
    );
    // Skipping validate refuses nothing: the stale directive goes unchecked
    // here and CI's llmlint job is what catches it.
    expect(run.stderr).not.toContain("refusing the push");
    expect(run.status).toBe(0);
  });

  test.skipIf(!llmlintInstalled)(
    "a tree validate accepts passes it quietly and the visual guard still runs",
    () => {
      const run = runHook(
        visualHead,
        visualBase,
        BASE_PATH.join(path.delimiter),
      );

      expect(run.stderr).not.toContain("llmlint");
      expect(run.stderr).toContain(GUARD_RAN);
      expect(run.status).toBe(0);
    },
  );

  test.skipIf(!llmlintInstalled)(
    "a stale suppression refuses the push after the visual guard has run",
    () => {
      inClone("checkout", "-q", "--detach", staleHead);
      try {
        const run = runHook(
          staleHead,
          visualBase,
          BASE_PATH.join(path.delimiter),
        );

        expect(run.stderr).toContain("'llmlint validate");
        expect(run.stderr).toContain('unknown rule "no_such_rule"');
        // The guard's own verdict is a permissive skip; it still ran after the
        // validate failure, and the hook refused only once it had.
        const guard = run.stderr.indexOf(GUARD_RAN);
        expect(guard).toBeGreaterThan(run.stderr.indexOf("no_such_rule"));
        expect(
          run.stderr.indexOf(
            "pre-push: refusing the push because 'llmlint validate' failed",
          ),
        ).toBeGreaterThan(guard);
        expect(run.status).toBe(1);
      } finally {
        inClone("checkout", "-q", "--detach", visualHead);
      }
    },
  );
});
