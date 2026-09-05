import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
// A second clone that can resolve the workspace: its node_modules is a symlink
// to this repository's, which is all `pnpm exec nx` needs to report the affected
// microfrontends. That lets a test reach the stages after Nx while every file it
// writes stays inside a disposable tree.
let installedClone: string;
let installedVisual: PushRange;
// A third clone, for the one test that reaches the capture container — and the
// only one with NO node_modules at all, which is the state that test is about:
// the container's /work/node_modules mountpoint has to exist in the tree before
// Docker starts, because Docker creates a missing bind-mount destination itself
// and creates it as root. No other test may touch this tree, since what the hook
// created in it is the assertion.
let captureClone: string;
let captureVisual: PushRange;
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
  installedClone = path.join(cloneRoot, "installed");
  execFileSync("git", [
    "clone",
    "--shared",
    "--no-checkout",
    REPO,
    installedClone,
  ]);
  execFileSync("git", [
    "-C",
    installedClone,
    "checkout",
    "--detach",
    git("rev-parse", "HEAD"),
  ]);
  symlinkSync(
    path.join(REPO, "node_modules"),
    path.join(installedClone, "node_modules"),
    "dir",
  );
  installedVisual = writeVisualRange(
    installedClone,
    path.join(cloneRoot, "installed-index"),
  );
  captureClone = path.join(cloneRoot, "capture");
  execFileSync("git", [
    "clone",
    "--shared",
    "--no-checkout",
    REPO,
    captureClone,
  ]);
  execFileSync("git", [
    "-C",
    captureClone,
    "checkout",
    "--detach",
    git("rev-parse", "HEAD"),
  ]);
  // Deliberately no node_modules symlink here.
  captureVisual = writeVisualRange(
    captureClone,
    path.join(cloneRoot, "capture-index"),
  );
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

// The two boundaries between an uninstalled worktree and the capture container,
// so the hook can be driven over the whole of that stretch for real.
//
// `pnpm exec nx show projects` is the first. It is the reason no test could
// reach the capture step from a tree with no node_modules: Nx cannot load this
// workspace's own plugins from an uninstalled tree — it reports "Failed to load
// 1 Nx plugin(s): ./scripts/workspace/federation-plugin.mjs" and exits nonzero —
// and an uninstalled tree is precisely the state the capture step has to be
// observed in. The stand-in answers that one query and refuses every other, so
// it can never quietly answer for a boundary this case is not about. Real
// affected-project discovery stays covered by the two tests above, which run the
// real `pnpm exec nx` in an installed clone and reach the same app.
//
// Docker is the second, and it also has to record. What this case asserts cannot
// be read back after the hook returns: the host scratch the container writes
// into is removed on the way out, so ownership has to be observed at the instant
// the container would have started. The stand-in reports the daemon up, records
// that instant, and then fails the way a container that cannot start does —
// which is a refusal path the hook owns.
// llmlint: ignore[e2e_not_mocked] The layer under test is the unchanged real pre-push hook subprocess, driven over git's stdin protocol against a real clone and a real filesystem; these executable doubles stand in only for the two external providers, because Nx cannot run in the uninstalled tree this case requires and the real capture would run a containerized workspace install and browser capture that deletes the very scratch state this case exists to observe.
function captureBoundaryFixture(): {
  PATH: string;
  argv: () => string[];
  hostPaths: () => Map<string, string>;
  cleanup: () => void;
} {
  const shim = mkdtempSync(path.join(tmpdir(), "pre-push-capture-"));
  const argvFile = path.join(shim, "argv");
  const hostPathsFile = path.join(shim, "host-paths");
  const pnpm = path.join(shim, "pnpm");
  // llmlint: ignore[e2e_not_mocked] This replaces only the external Nx project-graph query, which cannot run at all in the uninstalled worktree under test; the hook's own JSON validation, filesystem work, and capture invocation downstream of it are the unmodified real thing.
  writeFileSync(
    pnpm,
    `#!/usr/bin/env bash
set -uo pipefail
if [ "\${1:-}" = "exec" ] && [ "\${2:-}" = "nx" ] && [ "\${3:-}" = "show" ] && [ "\${4:-}" = "projects" ]; then
  printf '["courses"]'
  exit 0
fi
echo "pnpm: this fixture answers only 'pnpm exec nx show projects'; asked for: $*" >&2
exit 1
`,
  );
  chmodSync(pnpm, 0o755);
  const docker = path.join(shim, "docker");
  // NUL-separated, because the capture invocation's last argument is a whole
  // shell script and a line-separated record could not be split back into it.
  // llmlint: ignore[e2e_not_mocked] This replaces only the external Docker CLI, reporting the daemon's real "up" status and a real container-start failure; spawnSync still drives the unmodified hook through its public stdin/environment boundary.
  writeFileSync(
    docker,
    `#!/usr/bin/env bash
set -uo pipefail
if [ "\${1:-}" != "run" ]; then exit 0; fi
printf '%s\\0' "$@" >"${argvFile}"
: >"${hostPathsFile}"
record() {
  if [ -e "$2" ]; then
    printf '%s\\t%s\\n' "$1" "$(stat -c '%u:%g %F' "$2")" >>"${hostPathsFile}"
  else
    printf '%s\\tmissing\\n' "$1" >>"${hostPathsFile}"
  fi
}
record tree-node-modules "$PWD/node_modules"
home=""
for arg in "$@"; do
  case "$arg" in HOME=*) home="\${arg#HOME=}" ;; esac
done
prev=""
for arg in "$@"; do
  if [ "$prev" = "-v" ]; then
    src="\${arg%%:*}"
    dest="\${arg#*:}"
    dest="\${dest%%:*}"
    record "mount \${src}" "$src"
    case "$home" in
      "$dest") record home "$src" ;;
      "$dest"/*) record home "$src/\${home#"$dest"/}" ;;
    esac
  fi
  prev="$arg"
done
echo 'the capture container could not be started' >&2
exit 1
`,
  );
  chmodSync(docker, 0o755);
  return {
    PATH: `${shim}${path.delimiter}${CLEAN_PATH}`,
    argv: () => readFileSync(argvFile, "utf8").split("\0").slice(0, -1),
    hostPaths: () =>
      new Map(
        readFileSync(hostPathsFile, "utf8")
          .split("\n")
          .filter((line) => line !== "")
          .map((line) => {
            const [label, owner] = line.split("\t");
            return [label, owner] as [string, string];
          }),
      ),
    cleanup: () => rmSync(shim, { force: true, recursive: true }),
  };
}

// The values a repeated `docker run` flag was given, in order.
function valuesOf(argv: string[], flag: string): string[] {
  return argv.filter((_, index) => index > 0 && argv[index - 1] === flag);
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

  // A capture that ran as root left shots/ and shots/current/ owned by root, and
  // the host side then has to create shots/review/<app> beside them: that mkdir
  // failed with EACCES, and the guard announced the failure as a drift-review
  // problem on every later push from the worktree. Ownership cannot be forged
  // without privileges, so this fixture reproduces the wedge as the filesystem
  // sees it — a shots/ this user can neither write into nor empty — and the hook
  // has to clear it and go on to reach a verdict of its own.
  // llmlint: ignore-block[e2e_not_mocked] The layer under test is the unchanged real pre-push hook subprocess over a real filesystem; the PATH shim only makes the external Docker provider give its documented daemon-unavailable response, which ends the run at the guard's next real decision rather than at a capture this case is not about.
  test("capture output the pusher cannot write beside is reclaimed, not a wedge", () => {
    const shots = path.join(installedClone, "shots");
    mkdirSync(path.join(shots, "current", "courses", "x86_64"), {
      recursive: true,
    });
    writeFileSync(
      path.join(shots, "current", "courses", "x86_64", "a.png"),
      "",
    );
    chmodSync(shots, 0o555);
    expect(() => mkdirSync(path.join(shots, "review"))).toThrow(/EACCES/);
    const noDocker = dockerUnavailableFixture();
    try {
      const run = runHook({
        cwd: installedClone,
        localSha: installedVisual.head,
        remoteSha: installedVisual.base,
        env: { NX_DAEMON: "false", PATH: noDocker.PATH },
      });
      expect(run.stderr).toContain("reclaiming it");
      expect(run.stderr).toContain("the steps below can write into it again");
      // Past the wedge and on to the guard's own verdict, rather than dead on a
      // filesystem error it would have announced as visual drift.
      expect(run.stderr).toContain("Docker is not available");
      expect(run.status).toBe(1);
    } finally {
      noDocker.cleanup();
      chmodSync(shots, 0o755);
    }
    // What the wedge blocked is possible again, and the unusable tree is gone.
    mkdirSync(path.join(shots, "review", "courses"), { recursive: true });
    expect(existsSync(path.join(shots, "current"))).toBe(false);
  });
  // llmlint: ignore-end[e2e_not_mocked]

  // The capture container bind-mounts this worktree, so it runs as the pusher
  // rather than as root: a root capture leaves ~39,000 files there that their
  // owner cannot delete, and a disposable worktree reclaimed by a sweeper that
  // is not root is then permanent residue. That mapping only works as a package
  // of four, and none of the four can be carried without the others. A mapped
  // uid cannot install into an anonymous Docker volume, which is created
  // root-owned, so the node_modules mask is a host directory the hook made; it
  // has no entry in the image's passwd file, so HOME is one too; Docker
  // materializes a missing bind-mount destination as root, so the mask's
  // mountpoint inside the tree is made here as well; and the scratch holding all
  // of it goes away however the hook exits, including this refusal.
  //
  // The tree this runs in has no node_modules, which is the only state in which
  // that third part is load-bearing: with nothing at /work/node_modules on the
  // host, Docker is the one that creates it, and it creates it root-owned inside
  // the bind mount. So the hook has to have made it — as the pusher, before
  // `docker run` — and that is what the recorder observes.
  // llmlint: ignore-block[e2e_not_mocked] The subject is the unchanged real hook subprocess over a real clone and a real filesystem, driven through git's push-ref stdin protocol; the two external providers are stood in for because Nx cannot run in the uninstalled tree this case requires and the real capture would run a containerized workspace install and browser capture — and would remove the host scratch whose ownership at container-start is exactly what this case has to observe. The capture container's own render path stays owned by the app screenshot targets the hook dispatches.
  test("the capture container runs as the pusher, over host paths already theirs", () => {
    const uid = process.getuid?.();
    const gid = process.getgid?.();
    if (uid === undefined || gid === undefined) {
      throw new Error(
        "the container-user contract is a POSIX uid:gid mapping; this host has none",
      );
    }
    const hostUser = `${uid}:${gid}`;
    const treeMountpoint = path.join(captureClone, "node_modules");
    // Nothing here for Docker to find, and so nothing but the hook can have put
    // it there by the time the container starts.
    expect(existsSync(treeMountpoint)).toBe(false);
    const capture = captureBoundaryFixture();
    try {
      const run = runHook({
        cwd: captureClone,
        localSha: captureVisual.head,
        remoteSha: captureVisual.base,
        env: { NX_DAEMON: "false", PATH: capture.PATH },
      });
      // A container that cannot start is a refusal, and it names what it was
      // capturing when it happened.
      expect(run.status).toBe(1);
      expect(run.stderr).toContain("PUSH BLOCKED");
      expect(run.stderr).toContain("Capturing courses");

      const argv = capture.argv();
      const observed = capture.hostPaths();
      const containerCommand = argv.at(-1) ?? "";
      // This repository's adaptations reached the container intact: the app Nx
      // reported affected, and the corepack-installed pnpm that installs the
      // workspace before the screenshot target runs.
      expect(valuesOf(argv, "-e")).toContain("SCREENCOMP_APPS=courses");
      expect(containerCommand).toContain("corepack enable");
      expect(containerCommand).toContain("pnpm install --frozen-lockfile");
      expect(containerCommand).toContain('nx run "$app:screenshot"');

      // 1. It runs as the user who invoked the hook.
      expect(valuesOf(argv, "--user")).toEqual([hostUser]);

      // 2. Every mount is a host path, and the one masking node_modules is a
      //    directory that user already owned when the container started.
      const mounts = valuesOf(argv, "-v");
      expect(mounts.filter((mount) => !mount.includes(":"))).toEqual([]);
      const mask = mounts.find((mount) =>
        mount.endsWith(":/work/node_modules"),
      );
      if (mask === undefined) {
        throw new Error(
          `nothing masks /work/node_modules: ${mounts.join(" ")}`,
        );
      }
      const maskSource = mask.slice(0, mask.lastIndexOf(":"));
      expect(observed.get(`mount ${maskSource}`)).toBe(`${hostUser} directory`);
      // Its mountpoint inside the bind-mounted tree was there, and was the
      // pusher's, before the container started — so Docker had nothing to
      // create there as root. It was absent until the hook ran.
      expect(observed.get("tree-node-modules")).toBe(`${hostUser} directory`);

      // 3. HOME is a host directory that user owns, for a uid the image's
      //    passwd file does not know.
      const home = valuesOf(argv, "-e").find((value) =>
        value.startsWith("HOME="),
      );
      expect(home).toBeDefined();
      expect(observed.get("home")).toBe(`${hostUser} directory`);

      // 4. The scratch behind both is gone, on the way out of a refusal.
      expect(existsSync(path.dirname(maskSource))).toBe(false);
    } finally {
      capture.cleanup();
    }
    // The mountpoint the hook made outlives it, owned by the pusher: it is a
    // real directory in the tree, not a root-owned one Docker left behind.
    expect(statSync(treeMountpoint).uid).toBe(uid);
    expect(statSync(treeMountpoint).isDirectory()).toBe(true);
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
