import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
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

/** A root no run has ever held, so each case starts from no holds at all. */
function artifactRoot() {
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
    const root = artifactRoot();
    writeHold(root, otherRun);

    expect(() => hold(root, "serving")).not.toThrow();

    expect(readdirSync(artifactHoldDirectory(root)).sort()).toEqual(
      [`${otherRun}.json`, `${process.pid}.json`].sort(),
    );
  });

  it("refuses to compose an artifact another run is serving", () => {
    const root = artifactRoot();
    writeHold(root, otherRun);

    expect(() => hold(root, "composing")).toThrow(
      new RegExp(
        `held by process ${otherRun}, which is serving it[\\s\\S]*never run two gates at once`,
      ),
    );
  });

  it("refuses to serve an artifact another run is composing", () => {
    const root = artifactRoot();
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
    const root = artifactRoot();
    hold(root, "serving");

    expect(() => hold(root, "composing")).not.toThrow();
  });

  it.each([
    ["a run that was killed before it released", undefined],
    ["a record that no longer reads back as one", "not a hold at all"],
    ["a record naming no process that could be running", '{"pid":0}'],
  ])("composes over the hold left by %s", (_case, contents) => {
    const root = artifactRoot();
    const abandoned = writeHold(root, abandonedPid(), contents);

    expect(() => hold(root, "composing")).not.toThrow();

    // Left in place, it would block every later compose on this machine.
    expect(readdirSync(artifactHoldDirectory(root))).not.toContain(
      basename(abandoned),
    );
  });

  it("frees the artifact once, however often its release is called", () => {
    const root = artifactRoot();
    const release = hold(root, "serving");

    release();
    release();

    expect(readdirSync(artifactHoldDirectory(root))).toEqual([]);
    expect(() => hold(root, "composing")).not.toThrow();
  });

  it("keys one artifact directory apart from another beside it", () => {
    const root = artifactRoot();

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
