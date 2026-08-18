import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  type ArtifactActivity,
  artifactHoldDirectory,
  holdArtifactRoot,
} from "./artifact-hold.ts";

const released: (() => void)[] = [];
const roots: string[] = [];

/** The other live run every case below is held against: this one's parent. */
const otherRun = process.ppid;

/** Makes a root no run has ever held, so each case starts from no holds at all. */
function createArtifactRoot() {
  const root = mkdtempSync(join(tmpdir(), "artifact-hold-"));
  roots.push(root);
  return root;
}

function hold(root: string, activity: ArtifactActivity) {
  const release = holdArtifactRoot(root, activity);
  released.push(release);
  return release;
}

/** One run's hold on `root`, written as that run's own process would write it. */
function writeHold(root: string, pid: number, contents?: string) {
  const directory = artifactHoldDirectory(root);
  mkdirSync(directory, { recursive: true });
  const file = join(directory, `${pid}.json`);
  writeFileSync(
    file,
    contents ?? `${JSON.stringify({ pid, activity: "serving", root })}\n`,
  );
  return file;
}

/** A process id no process carries, which is what a killed run leaves behind. */
function abandonedPid() {
  for (let candidate = 30_000; candidate < 40_000; candidate += 1) {
    try {
      process.kill(candidate, 0);
    } catch (error) {
      // The same Node system error the module under test narrows: `code` is
      // what separates ESRCH, the one code that means no process carries this
      // id, from an EPERM raised by a live process another user owns.
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return candidate;
    }
  }
  throw new Error("every candidate process id on this host is in use");
}

afterEach(() => {
  for (const release of released.splice(0)) release();
  for (const root of roots.splice(0)) {
    rmSync(artifactHoldDirectory(root), { force: true, recursive: true });
    rmSync(root, { force: true, recursive: true });
  }
});

describe("holding a composed artifact directory", () => {
  it("lets every run that only serves one artifact hold it together", () => {
    // What `nx affected -t e2e --parallel=3` does: several apps' Playwright
    // servers answer from one composed artifact, and none of them writes to it.
    const root = createArtifactRoot();
    writeHold(root, otherRun);

    expect(() => hold(root, "serving")).not.toThrow();

    expect(readdirSync(artifactHoldDirectory(root)).sort()).toEqual(
      [`${otherRun}.json`, `${process.pid}.json`].sort(),
    );
  });

  it("refuses to compose an artifact another run is serving", () => {
    const root = createArtifactRoot();
    writeHold(root, otherRun);

    expect(() => hold(root, "composing")).toThrow(
      new RegExp(
        `held by process ${otherRun}, which is serving it[\\s\\S]*never run two gates at once`,
      ),
    );
  });

  it("refuses to serve an artifact another run is composing", () => {
    const root = createArtifactRoot();
    writeHold(
      root,
      otherRun,
      `${JSON.stringify({ pid: otherRun, activity: "composing", root })}\n`,
    );

    expect(() => hold(root, "serving")).toThrow(
      new RegExp(`held by process ${otherRun}, which is composing it`),
    );
  });

  it("never blocks a run on the hold it took itself", () => {
    const root = createArtifactRoot();
    hold(root, "serving");

    expect(() => hold(root, "composing")).not.toThrow();
  });

  it.each([
    ["a run that was killed before it released", undefined],
    ["a record that no longer reads back as one", "not a hold at all"],
    ["a record naming no process that could be running", '{"pid":0}'],
  ])("composes over the hold left by %s", (_case, contents) => {
    const root = createArtifactRoot();
    const abandoned = writeHold(root, abandonedPid(), contents);

    expect(() => hold(root, "composing")).not.toThrow();

    // Left in place, it would block every later compose on this machine.
    expect(readdirSync(artifactHoldDirectory(root))).not.toContain(
      basename(abandoned),
    );
  });

  it("composes over a live hold that names some other artifact", () => {
    const root = createArtifactRoot();
    // Its process is this run's own parent, so only the root it names can be
    // what tells this hold apart from one on the artifact being claimed.
    const misplaced = writeHold(
      root,
      otherRun,
      `${JSON.stringify({
        pid: otherRun,
        activity: "serving",
        root: join(root, "somewhere-else"),
      })}\n`,
    );

    expect(() => hold(root, "composing")).not.toThrow();

    expect(readdirSync(artifactHoldDirectory(root))).not.toContain(
      basename(misplaced),
    );
  });

  it("frees the artifact once, however often its release is called", () => {
    const root = createArtifactRoot();
    const release = hold(root, "serving");

    release();
    release();

    expect(readdirSync(artifactHoldDirectory(root))).toEqual([]);
    expect(() => hold(root, "composing")).not.toThrow();
  });

  it("stays releasable when its own record can no longer be removed", () => {
    const root = createArtifactRoot();
    const release = holdArtifactRoot(root, "serving");
    const record = join(artifactHoldDirectory(root), `${process.pid}.json`);
    // The e2e server releases from a process exit handler, so a release that
    // threw would replace whatever that run was already reporting with this.
    // The record left behind is one the next run prunes: its pid is gone.
    rmSync(record, { force: true });
    mkdirSync(join(record, "occupied"), { recursive: true });

    expect(() => release()).not.toThrow();
  });

  it("names the hold directory and what clears it when it cannot be used", () => {
    const root = createArtifactRoot();
    const directory = artifactHoldDirectory(root);
    // A file where the hold directory belongs is what a wrong umask, a full
    // disk, or a stray write leaves behind: the claim cannot be recorded, and
    // compose and the e2e server each print the thrown message and nothing
    // else, so it has to carry the next action itself.
    mkdirSync(join(directory, ".."), { recursive: true });
    writeFileSync(directory, "");
    roots.push(root);

    expect(() => holdArtifactRoot(root, "composing")).toThrow(
      new RegExp(
        `could not be claimed for composing: .+\\. Check that ${directory} is writable, or delete it to clear every hold recorded there, then rerun just check\\.`,
      ),
    );
  });

  it("keys one artifact directory apart from another beside it", () => {
    const root = createArtifactRoot();

    expect(artifactHoldDirectory(join(root, "shell"))).not.toBe(
      artifactHoldDirectory(join(root, "site")),
    );
    // The same directory reached by two spellings is one artifact, so two runs
    // naming it differently still collide.
    expect(artifactHoldDirectory(join(root, "site/../shell"))).toBe(
      artifactHoldDirectory(join(root, "shell")),
    );
  });
});

/**
 * Two composers that genuinely race, run as the separate processes they are in
 * life: one `just check` started while another is already underway. Only real
 * processes can reach the window this covers, because it opens between one run
 * reading the hold directory and the same run writing into it, and a second
 * caller inside this process would share its pid and be waved through as the
 * hold it took itself.
 */
const holdModule = pathToFileURL(
  resolve("libs/artifact-contracts/src/artifact-hold.ts"),
).href;

/**
 * One racing composer: it reports itself ready, blocks until the barrier the
 * parent drops frees both children at once, and only then claims the artifact.
 * Having decided, it stays alive until its rival has decided too — a run that
 * exited first would leave a hold whose process is gone, which the other run is
 * right to prune, and the race would go unobserved.
 */
function raceProbe(resultOne: string, resultOther: string) {
  return [
    'import { existsSync, writeFileSync } from "node:fs";',
    'import { tmpdir } from "node:os";',
    'import { resolve } from "node:path";',
    `import { holdArtifactRoot } from ${JSON.stringify(holdModule)};`,
    // Every path this probe is handed becomes a filesystem read or write, so
    // argv is narrowed here the way the module under test narrows its own
    // callers: four paths, each beneath the temporary directory this spec
    // builds its scratch under, and nothing else runs.
    "const given = process.argv.slice(2);",
    'const scratch = resolve(tmpdir()) + "/";',
    "if (",
    "  given.length !== 4 ||",
    '  given.some((path) => typeof path !== "string" || !resolve(path).startsWith(scratch))',
    ")",
    "  throw new Error(",
    '    "probe takes the artifact root, the barrier, its ready file, and its result file, each beneath " + scratch + ", not " + JSON.stringify(given),',
    "  );",
    "const [root, barrier, ready, mine] = given;",
    "const idle = new Int32Array(new SharedArrayBuffer(4));",
    "const pause = () => Atomics.wait(idle, 0, 0, 5);",
    'writeFileSync(ready, "");',
    "while (!existsSync(barrier)) pause();",
    'let outcome = "refused";',
    "try {",
    '  holdArtifactRoot(root, "composing");',
    '  outcome = "held";',
    "} catch {}",
    "writeFileSync(mine, outcome);",
    `const rivals = [${JSON.stringify(resultOne)}, ${JSON.stringify(resultOther)}];`,
    "for (let waited = 0; waited < 2000; waited += 1) {",
    "  if (rivals.every((path) => existsSync(path))) break;",
    "  pause();",
    "}",
    "",
  ].join("\n");
}

function runProbe(
  probe: string,
  root: string,
  barrier: string,
  ready: string,
  mine: string,
) {
  return new Promise<void>((settle) => {
    const child = spawn(process.execPath, [probe, root, barrier, ready, mine], {
      stdio: "ignore",
    });
    child.on("exit", () => settle());
    child.on("error", () => settle());
  });
}

describe("two composers reaching one artifact at the same moment", () => {
  it("never lets both of them believe they hold it", async () => {
    const raceScratch = mkdtempSync(join(tmpdir(), "artifact-hold-race-"));
    roots.push(raceScratch);
    for (let round = 0; round < 3; round += 1) {
      const root = createArtifactRoot();
      const barrier = join(raceScratch, `barrier-${round}`);
      const side = (which: number) => ({
        probe: join(raceScratch, `probe-${round}-${which}.ts`),
        ready: join(raceScratch, `ready-${round}-${which}`),
        result: join(raceScratch, `result-${round}-${which}`),
      });
      const one = side(0);
      const other = side(1);
      const paths = [one, other];
      for (const side of paths)
        writeFileSync(side.probe, raceProbe(one.result, other.result));

      const running = paths.map((side) =>
        runProbe(side.probe, root, barrier, side.ready, side.result),
      );
      // The barrier drops only once both children are parked on it, so they
      // contend for the same instant rather than arriving one after the other.
      for (let waited = 0; waited < 4000; waited += 1) {
        if (paths.every((side) => existsSync(side.ready))) break;
        await new Promise((tick) => setTimeout(tick, 5));
      }
      writeFileSync(barrier, "");
      await Promise.all(running);

      const outcomes = paths.map((side) =>
        existsSync(side.result) ? readFileSync(side.result, "utf8") : "absent",
      );
      // Refusing both is a correct answer to a dead heat; composing twice over
      // one directory is the overlap every hold in this module exists to stop.
      expect(outcomes, `round ${round}`).not.toEqual(["held", "held"]);
      expect(outcomes, `round ${round}`).not.toContain("absent");
    }
  }, 60_000);
});
