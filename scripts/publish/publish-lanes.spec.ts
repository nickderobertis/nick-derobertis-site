import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { describe, expect, onTestFinished, test } from "vitest";

// The affected-only economics of the Pages deploy. `.github/workflows/pages.yml`
// asks exactly one question — `just publish-lanes` for a manual dispatch that
// seeds every lane, `just publish-lanes <base> <head>` for a push — and feeds the
// answer straight into its `publish` matrix. These tests drive that same command
// surface, so an affected library is never a lane and an unaffected app is never
// rebuilt, republished, or redeployed.

/**
 * Both the recipe and Nx hand back JSON this file then treats as project names,
 * so neither is trusted until it has been narrowed to that shape.
 */
function projectNames(output: string, source: string): string[] {
  const parsed: unknown = JSON.parse(output);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (name) => typeof name === "string" && /^[a-z][a-z0-9-]*$/.test(name),
    )
  )
    throw new Error(`${source} did not emit a list of Nx project names`);
  return parsed;
}

/** An Nx project file is config on disk, so its targets are narrowed too. */
function buildTargetNames(projectFile: string): string[] {
  const parsed: unknown = JSON.parse(readFileSync(projectFile, "utf8"));
  const targets: unknown =
    parsed && typeof parsed === "object" && "targets" in parsed
      ? parsed.targets
      : undefined;
  if (!targets || typeof targets !== "object" || Array.isArray(targets))
    throw new Error(`${projectFile} declares no Nx targets`);
  return Object.keys(targets);
}

function publishLanes(range: string[] = [], env?: NodeJS.ProcessEnv): string[] {
  return projectNames(
    execFileSync("just", ["publish-lanes", ...range], {
      encoding: "utf8",
      timeout: 120_000,
      env,
    }),
    "just publish-lanes",
  );
}

function affectedProjects(
  [base, head]: PushRange,
  env: NodeJS.ProcessEnv,
): string[] {
  return projectNames(
    execFileSync(
      "pnpm",
      [
        "exec",
        "nx",
        "show",
        "projects",
        "--affected",
        `--base=${base}`,
        `--head=${head}`,
        "--with-target=build",
        "--json",
      ],
      { encoding: "utf8", timeout: 120_000, env },
    ),
    "nx show projects --affected",
  );
}

/**
 * Git's plumbing hands back object names this file spends as arguments to the
 * next git command and as one end of the range under test, so each is narrowed
 * to the hash it has to be before it is spent. An answer that was something
 * else would otherwise reach Nx as a revision and surface several layers down
 * as an ambiguous git argument, naming the range but not what is wrong with it.
 */
function objectName(output: string, step: string): string {
  const name = output.trim();
  if (!/^[0-9a-f]{40}$/.test(name))
    throw new Error(`git ${step} did not name an object: ${name || "nothing"}`);
  return name;
}

type PushRange = [base: string, head: string];

/**
 * Where this repository keeps its own objects, narrowed before it is spent as
 * an alternate store. A value that was not an existing absolute directory would
 * leave the fixture's `read-tree` unable to reach HEAD and fail several commands
 * later, naming neither the path nor where it came from.
 */
function repositoryObjectStore(): string {
  const objects = execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-path", "objects"],
    { encoding: "utf8" },
  ).trim();
  if (
    !isAbsolute(objects) ||
    !statSync(objects, { throwIfNoEntry: false })?.isDirectory()
  )
    throw new Error(
      `git rev-parse did not name this repository's object directory: ${objects || "nothing"}`,
    );
  return objects;
}

/**
 * The caller's environment with every `GIT_*` setting dropped. The fixture
 * below decides for itself which object store, index, and identity its git
 * commands use, and an inherited `GIT_DIR`, `GIT_INDEX_FILE`, or object-store
 * variable would silently redirect exactly those. What remains is forwarded to
 * start a subprocess — PATH, HOME, and Node's resolution — and is never read,
 * parsed, or branched on here.
 */
function withoutGitSettings(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(environment).filter(([name]) => !name.startsWith("GIT_")),
  );
}

/**
 * The library whose change the range below carries. It owns a build target, so
 * it is a project Nx reports as affected and would be a plausible lane, and it
 * is a data-access library behind one remote rather than a workspace-wide one,
 * so most registered apps stay unaffected and the lanes are a proper subset.
 */
const AFFECTED_LIBRARY = "data-access-awards";

/**
 * A push range that reaches a shared library, which is the case lane selection
 * has to get right — those projects are affected and buildable, but own no
 * content-store subtree, so they must never become lanes.
 *
 * The range is built, not found. Cutting it from the checkout's own history
 * made this test a function of how the repository had been cloned: a shallow
 * clone is grafted at the oldest commit it kept, so the commit touching `libs/`
 * has no parent to cut `<sha>~1` from, and the test failed for a reason that
 * says nothing about lane selection. Which library a found range reached varied
 * with history too, so the assertions could only describe the answer in the
 * abstract rather than name it.
 *
 * So the base is HEAD, which every checkout has however it was fetched, and the
 * head is a commit composed here: HEAD's tree with one file added under the
 * library above. Nx diffs the two ends directly, and `git diff` compares their
 * trees, so neither end needs any history behind it.
 *
 * The commit is written to a temporary object store the repository's git reads
 * through `GIT_ALTERNATE_OBJECT_DIRECTORIES`, so the range exists for the
 * commands under test without anything being added to the repository's own
 * objects; the store is removed with the test, and the commit with it.
 */
function rangeReachingSharedLibrary(): {
  range: PushRange;
  env: NodeJS.ProcessEnv;
} {
  const store = mkdtempSync(join(tmpdir(), "publish-lanes-objects-"));
  onTestFinished(() => rmSync(store, { force: true, recursive: true }));
  const objects = join(store, "objects");
  mkdirSync(objects, { recursive: true });
  // Writes land in the temporary store and reads fall back to the repository's,
  // which is where HEAD's tree and every blob under it already live. The
  // identity is fixed because `commit-tree` demands one a CI checkout has no
  // reason to have configured.
  const authoring: NodeJS.ProcessEnv = {
    ...withoutGitSettings(process.env),
    GIT_OBJECT_DIRECTORY: objects,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: repositoryObjectStore(),
    GIT_INDEX_FILE: join(store, "index"),
    GIT_AUTHOR_NAME: "Publish lanes fixture",
    GIT_AUTHOR_EMAIL: "publish-lanes@example.test",
    GIT_COMMITTER_NAME: "Publish lanes fixture",
    GIT_COMMITTER_EMAIL: "publish-lanes@example.test",
  };
  const author = (...args: string[]) =>
    execFileSync("git", args, { encoding: "utf8", env: authoring });

  author("read-tree", "HEAD");
  const blob = objectName(
    execFileSync("git", ["hash-object", "-w", "--stdin"], {
      encoding: "utf8",
      env: authoring,
      input: 'export const laneProbe = "a change only this library carries";\n',
    }),
    "hash-object",
  );
  author(
    "update-index",
    "--add",
    "--cacheinfo",
    `100644,${blob},libs/${AFFECTED_LIBRARY}/src/lane-probe.ts`,
  );
  const tree = objectName(author("write-tree"), "write-tree");
  const head = objectName(
    author(
      "commit-tree",
      tree,
      "-p",
      "HEAD",
      "-m",
      `feat(${AFFECTED_LIBRARY}): a library change no lane may publish`,
    ),
    "commit-tree",
  );

  // The commands under test read the range through this one added setting; the
  // repository's own object store stays their primary, so they resolve HEAD
  // exactly as they would without it.
  return {
    range: ["HEAD", head],
    env: {
      ...withoutGitSettings(process.env),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: objects,
    },
  };
}

function registeredApps(): string[] {
  const manifest: unknown = JSON.parse(
    readFileSync("libs/build-config/src/remotes.json", "utf8"),
  );
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest))
    throw new Error("the remote registry must map remote names to aliases");
  return projectNames(
    JSON.stringify(["shell", ...Object.keys(manifest)]),
    "libs/build-config/src/remotes.json",
  ).sort();
}

describe("publish lane selection", () => {
  test("a manual dispatch seeds every registered app's lane", () => {
    expect(publishLanes()).toEqual(registeredApps());
  }, 30_000);

  test("a push range publishes only apps, never the libraries it also affects", () => {
    const { range, env } = rangeReachingSharedLibrary();
    const apps = registeredApps();
    const affected = affectedProjects(range, env);
    const libraries = affected.filter((project) => !apps.includes(project));
    // The range changes the library itself, so Nx reports it as affected and
    // it reaches lane selection as a buildable project that owns no lane.
    expect(libraries).toContain(AFFECTED_LIBRARY);

    const lanes = publishLanes(range, env);

    expect(lanes).toEqual(
      affected.filter((project) => apps.includes(project)).sort(),
    );
    for (const library of libraries) expect(lanes).not.toContain(library);
    // The library sits behind one remote rather than the whole workspace, so
    // the lanes are a proper non-empty subset of the registered apps: the other
    // side of the same economics, where an unaffected app is never republished.
    expect(lanes.length).toBeGreaterThan(0);
    expect(lanes.length).toBeLessThan(apps.length);
    // Two Nx graph loads in one test, which the full gate runs alongside three
    // other projects; the default 5s budget is for in-process work, not this.
  }, 180_000);

  test("a range that does not resolve to commits is refused before Nx runs", () => {
    const result = spawnSync(
      "just",
      ["publish-lanes", "not-a-commit", "HEAD"],
      {
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(
      /publish-lanes: base and head must resolve to commits.*select every lane/s,
    );
    expect(result.stdout).toBe("");
  }, 30_000);

  test("a range git would read as an option is refused before it reaches git", () => {
    const result = spawnSync("just", ["publish-lanes", "--all", "HEAD"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(
      /publish-lanes: base and head must resolve to commits/,
    );
    expect(result.stdout).toBe("");
  }, 30_000);

  test("an unrecognized argument is refused rather than read as no lanes", () => {
    const result = spawnSync("just", ["publish-lanes", "--al"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(
      /publish-lanes: base and head must resolve to commits/,
    );
    expect(result.stdout).toBe("");
  }, 30_000);

  // `just build-app` is what a publish lane runs, and a lane may build only a
  // project that owns a content-store subtree. A buildable library is a valid
  // Nx build target and would otherwise slip through.
  test("build-app refuses a buildable library that owns no publish lane", () => {
    expect(buildTargetNames("libs/design-system/project.json")).toContain(
      "build",
    );
    expect(registeredApps()).not.toContain("design-system");

    const result = spawnSync("just", ["build-app", "design-system"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(
      /"design-system" is not a publish lane.*owns no content-store subtree/s,
    );
    expect(result.stderr).toContain("build-app: app must name a publish lane");
  }, 30_000);

  // The lane list reaches this recipe as JSON, and an argument shaped like a
  // fragment of that text spans two adjacent entries. It has to be compared
  // against the lanes themselves, so this is refused as the single name it is.
  test("build-app refuses an argument that spans two serialized lane names", () => {
    const lanes = publishLanes();
    const [first, second] = lanes;
    if (!first || !second)
      throw new Error("two publish lanes are needed to build a spanning name");
    expect(JSON.stringify(lanes)).toContain(`"${first}","${second}"`);

    const result = spawnSync("just", ["build-app", `${first}","${second}`], {
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("is not a publish lane");
  }, 30_000);

  // The selection Nx pipes into the matrix is exercised by the push-range test
  // above, which drives `just publish-lanes` over real `nx show projects`
  // output. There is no recipe that feeds that step a hand-written selection,
  // so its stdin contract has no separate command surface to test through.

  test("every selected lane names a project the workspace can build", () => {
    for (const lane of publishLanes())
      expect(buildTargetNames(`apps/${lane}/project.json`)).toContain("build");
  }, 30_000);
});

// A publish lane's log is read when something has gone wrong, so a successful
// recipe emits only its own result and a failing one emits only guidance —
// never the shell body Just would otherwise echo.
describe("publish command surface output", () => {
  test("a successful lane selection prints only the matrix", () => {
    const result = spawnSync("just", ["publish-lanes"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trimEnd().split("\n")).toHaveLength(1);
    expect(projectNames(result.stdout, "just publish-lanes")).toEqual(
      registeredApps(),
    );
  }, 30_000);

  test("a refused build names the fix without echoing the recipe body", () => {
    const result = spawnSync("just", ["build-app", "design-system"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    const lines = result.stderr.trimEnd().split("\n");
    expect(lines[0]).toMatch(/^publishable-apps: "design-system" is not/);
    expect(lines[1]).toMatch(/^build-app: app must name a publish lane/);
    expect(result.stderr).not.toContain("scripts/publish/publishable-apps.mjs");
    expect(result.stderr).not.toContain("mktemp");
  }, 30_000);

  test("a refused publish names the fix without echoing the recipe body", () => {
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => !name.startsWith("PUBLISH_"),
      ),
    );

    const result = spawnSync("just", ["publish-fragment"], {
      encoding: "utf8",
      env: environment,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "publish-fragment: PUBLISH_APP must name a publishable app",
    );
    expect(result.stderr).toContain(
      "nothing was written to the content-store branch",
    );
    expect(result.stderr).not.toContain(
      "node scripts/publish/publish-fragment.mjs",
    );
    expect(result.stdout).toBe("");
  }, 30_000);
});
