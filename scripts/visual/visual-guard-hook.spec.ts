import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

// .githooks/pre-push is the local half of the visual drift gate. It runs under
// `set -euo pipefail`, so any command that fails outside a guarded position ends
// it on the spot — before the messages it keeps for its own failure paths. git
// then reports a bare "failed to push some refs" and the only layer that knew
// why has already exited. A clone with no node_modules did exactly that:
// `pnpm exec nx` exits 254 for the missing binary, killing the hook inside a
// command substitution.
//
// Every test here runs the real hook the way git runs it — as a subprocess, with
// the push refs on stdin — and asserts the outcome it announced. The contract is
// that the hook has exactly three ways to end: a silent pass when it evaluated
// the push and found nothing to say, a loud skip when it could not evaluate the
// push at all, and a loud refusal when it evaluated the push and could not clear
// it. There is no fourth way, and none of the three is silent about a refusal.

const HOOK = path.resolve(".githooks/pre-push");
const REPO = process.cwd();
const SUBPROCESS_HOME = process.env.HOME;
if (SUBPROCESS_HOME === undefined || SUBPROCESS_HOME === "") {
  throw new Error(
    "visual guard hook tests require HOME to resolve CLI configuration",
  );
}

// The test runner prepends this workspace's node_modules/.bin to PATH, which
// would let an uninstalled clone resolve *this* repository's nx and defeat the
// fixture. Strip those entries so "no workspace install" means it.
// llmlint: ignore[boundary_inputs_validated] PATH is test-runner infrastructure, not product input; entries are preserved only to resolve the real git, bash, pnpm, node, and screencomp subprocesses, while workspace node_modules entries are deliberately removed for the uninstalled-clone fixture.
const CLEAN_PATH = (process.env.PATH ?? "")
  .split(path.delimiter)
  .filter(
    (entry) =>
      entry !== "" &&
      !path.resolve(entry).startsWith(path.join(REPO, "node_modules")),
  )
  .join(path.delimiter);

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", input: "" }).trim();
}

const GUARD_IDENTITY = [
  "-c",
  "user.email=guard@example.invalid",
  "-c",
  "user.name=guard",
];
// A real microfrontend source path: screenshot-relevant per [guard].paths in
// screencomp.toml, and owned by a project that has a screenshot target.
const VISUAL_SOURCE = "apps/courses/src/page.tsx";

interface PushRange {
  base: string;
  head: string;
}

// The push range a test names is built here rather than read out of the ambient
// checkout. CI clones shallow and hands `just check` a bare NX_BASE sha, so
// there is no history behind HEAD to name a range with, and asking for the
// parent of whatever commit the checkout happens to hold fails outright. Two
// `git commit-tree` calls write the range's commits straight into `repo`'s
// object store, off its own HEAD tree: no ref moves and no index or working-tree
// change, so this is equally safe to run against a contributor's own clone. All
// the surrounding checkout has to supply is HEAD.
function writeVisualRange(repo: string, indexFile: string): PushRange {
  const inRepo = (...args: string[]): string => git("-C", repo, ...args);
  const staged = (...args: string[]): string =>
    execFileSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_INDEX_FILE: indexFile },
      input: "",
    }).trim();
  const tree = inRepo("rev-parse", "HEAD^{tree}");
  const base = inRepo(
    ...GUARD_IDENTITY,
    "commit-tree",
    tree,
    "-m",
    "guard fixture: unchanged base",
  );
  staged("read-tree", tree);
  const blob = execFileSync(
    "git",
    ["-C", repo, "hash-object", "-w", "--stdin"],
    {
      encoding: "utf8",
      input: `${execFileSync(
        "git",
        ["-C", repo, "show", `HEAD:${VISUAL_SOURCE}`],
        {
          encoding: "utf8",
        },
      )}// guard fixture: a screenshot-relevant source change\n`,
    },
  ).trim();
  staged("update-index", "--cacheinfo", `100644,${blob},${VISUAL_SOURCE}`);
  return {
    base,
    head: inRepo(
      ...GUARD_IDENTITY,
      "commit-tree",
      staged("write-tree"),
      "-p",
      base,
      "-m",
      "guard fixture: a courses source change",
    ),
  };
}

interface HookRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runHook(options: {
  cwd: string;
  localSha: string;
  remoteSha: string;
  env?: Record<string, string>;
}): HookRun {
  const result = spawnSync(
    "bash",
    [HOOK, "origin", "https://example.invalid/repo.git"],
    {
      cwd: options.cwd,
      encoding: "utf8",
      input: `refs/heads/probe ${options.localSha} refs/heads/probe ${options.remoteSha}\n`,
      env: {
        HOME: SUBPROCESS_HOME,
        // Under CI the hook defers to the visual-docs workflow, so the ambient
        // CI variable has to be cleared for every test that is not about it.
        CI: "",
        PATH: CLEAN_PATH,
        ...options.env,
      },
    },
  );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

// A clone with no workspace install — the reported failure, reproduced exactly.
// `--shared` borrows this repository's objects when it can, and only
// node_modules is missing either way.
let uninstalledClone: string;
let cloneRoot: string;
// Each repository gets its own fixture range: cloning a shallow repository — how
// CI checks this one out — makes git ignore `--shared` and fetch instead, so the
// clone has an object store of its own and cannot see the range written here.
let cloneVisual: PushRange;
let repoVisual: PushRange;
let docsOnlyHead: string;
let docsOnlyBase: string;

beforeAll(() => {
  cloneRoot = mkdtempSync(path.join(tmpdir(), "pre-push-guard-"));
  uninstalledClone = path.join(cloneRoot, "probe");
  execFileSync("git", [
    "clone",
    "--shared",
    "--no-checkout",
    REPO,
    uninstalledClone,
  ]);
  execFileSync("git", [
    "-C",
    uninstalledClone,
    "checkout",
    "--detach",
    git("rev-parse", "HEAD"),
  ]);
  repoVisual = writeVisualRange(REPO, path.join(cloneRoot, "repo-index"));
  cloneVisual = writeVisualRange(
    uninstalledClone,
    path.join(cloneRoot, "clone-index"),
  );
  // A genuine documentation-only push, committed in the disposable clone.
  writeFileSync(path.join(uninstalledClone, "GUARD_NOTES.md"), "docs only\n");
  execFileSync("git", ["-C", uninstalledClone, "add", "GUARD_NOTES.md"]);
  execFileSync("git", [
    "-C",
    uninstalledClone,
    ...GUARD_IDENTITY,
    "commit",
    "-m",
    "docs: guard fixture",
  ]);
  const head = execFileSync(
    "git",
    ["-C", uninstalledClone, "rev-parse", "HEAD"],
    {
      encoding: "utf8",
    },
  ).trim();
  docsOnlyHead = head;
  docsOnlyBase = execFileSync(
    "git",
    ["-C", uninstalledClone, "rev-parse", `${head}^`],
    { encoding: "utf8" },
  ).trim();
});

afterAll(() => {
  rmSync(cloneRoot, { force: true, recursive: true });
});

// Docker down is how a real machine reports it: the client is installed, the
// daemon refuses. Nothing about the hook is replaced — only the environment it
// inspects.
// llmlint: ignore[e2e_not_mocked] The layer under test is the unchanged real pre-push hook subprocess; this executable double is the external Docker provider's documented daemon-unavailable response and lets the public hook boundary exercise its recovery path without depending on host daemon state.
function dockerUnavailableFixture(): { PATH: string; cleanup: () => void } {
  const shim = mkdtempSync(path.join(tmpdir(), "pre-push-nodocker-"));
  const docker = path.join(shim, "docker");
  // llmlint: ignore[e2e_not_mocked] This replaces only the external Docker provider with its real daemon-unavailable CLI contract; spawnSync still drives the unmodified hook through its public stdin/environment boundary.
  writeFileSync(
    docker,
    "#!/usr/bin/env bash\necho 'Cannot connect to the Docker daemon.' >&2\nexit 1\n",
  );
  chmodSync(docker, 0o755);
  return {
    PATH: `${shim}${path.delimiter}${CLEAN_PATH}`,
    cleanup: () => rmSync(shim, { force: true, recursive: true }),
  };
}

describe("visual guard pre-push hook", () => {
  test("a clone with no workspace install says what it could not do", () => {
    const run = runHook({
      cwd: uninstalledClone,
      localSha: cloneVisual.head,
      remoteSha: cloneVisual.base,
    });
    expect(run.stderr).not.toBe("");
    expect(run.stderr).toContain("could NOT evaluate this push");
    expect(run.stderr).toContain("pnpm exec nx show projects");
    expect(run.stderr).toContain('Command "nx" not found');
    expect(run.stderr).toContain("just bootstrap");
    // Skipped, not refused: a push the guard never evaluated is CI's to judge.
    expect(run.status).toBe(0);
  });

  test("a clone with no workspace install can be made a hard failure", () => {
    const run = runHook({
      cwd: uninstalledClone,
      localSha: cloneVisual.head,
      remoteSha: cloneVisual.base,
      env: { SCREENCOMP_GUARD_REQUIRE: "1" },
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("could NOT evaluate this push");
    expect(run.stderr).toContain(
      "Refusing the push because SCREENCOMP_GUARD_REQUIRE is set",
    );
    expect(run.stderr).not.toContain("allowing the push");
  });

  test("a push with nothing screenshot-relevant passes without a word", () => {
    const run = runHook({
      cwd: uninstalledClone,
      localSha: docsOnlyHead,
      remoteSha: docsOnlyBase,
    });
    expect(run.status).toBe(0);
    expect(run.stderr).toBe("");
    expect(run.stdout).toBe("");
  });

  test("an unreadable push range reports instead of reading as no changes", () => {
    const missing = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const run = runHook({
      cwd: uninstalledClone,
      localSha: git("rev-parse", "HEAD"),
      remoteSha: missing,
    });
    expect(run.stderr).toContain("could NOT evaluate this push");
    expect(run.stderr).toContain(
      "'git diff' could not list this push's changed files",
    );
    expect(run.status).toBe(0);
  });

  // llmlint: ignore-block[e2e_not_mocked] This case's subject is Docker being unavailable, which cannot be produced with a real Docker subprocess on a host where Docker is installed; the PATH shim creates the condition under test rather than standing in for a boundary the test avoids. The Docker-available guard path is not exercised by this case; enabled pre-push hooks exercise the real Docker and screencomp subprocesses.
  test("the guard still refuses a push it cannot capture, and says why", () => {
    const noDocker = dockerUnavailableFixture();
    try {
      const run = runHook({
        cwd: REPO,
        localSha: repoVisual.head,
        remoteSha: repoVisual.base,
        env: { PATH: noDocker.PATH },
      });
      expect(run.status).toBe(1);
      expect(run.stderr).toContain("PUSH BLOCKED");
      expect(run.stderr).toContain("Docker is not available");
      // It got far enough to name the affected microfrontend, which is the
      // evaluation the uninstalled clone could not perform.
      expect(run.stderr).toContain("courses");
      expect(run.stderr).toContain("git push --no-verify");
    } finally {
      noDocker.cleanup();
    }
  });
  // llmlint: ignore-end[e2e_not_mocked]

  test("under CI the guard defers to the visual-docs workflow", () => {
    const run = runHook({
      cwd: uninstalledClone,
      localSha: cloneVisual.head,
      remoteSha: cloneVisual.base,
      env: { CI: "1" },
    });
    expect(run.status).toBe(0);
    expect(run.stderr).toBe("");
  });
});
