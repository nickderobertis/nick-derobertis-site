import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

function publishLanes(...range: string[]): string[] {
  return projectNames(
    execFileSync("just", ["publish-lanes", ...range], {
      encoding: "utf8",
      timeout: 120_000,
    }),
    "just publish-lanes",
  );
}

function affectedProjects(...range: string[]): string[] {
  return projectNames(
    execFileSync(
      "pnpm",
      [
        "exec",
        "nx",
        "show",
        "projects",
        "--affected",
        `--base=${range[0]}`,
        `--head=${range[1]}`,
        "--with-target=build",
        "--json",
      ],
      { encoding: "utf8", timeout: 120_000 },
    ),
    "nx show projects --affected",
  );
}

/** Whether this checkout actually has the commit a revision names. */
function resolvesToCommit(revision: string, repository: string): boolean {
  return (
    spawnSync(
      "git",
      ["rev-parse", "--verify", "--quiet", `${revision}^{commit}`],
      { cwd: repository, encoding: "utf8" },
    ).status === 0
  );
}

/**
 * A push range that provably reaches the shared libraries, which is the case
 * lane selection has to get right. It is derived from history rather than
 * assumed of the last commit, because a documentation-only commit affects no
 * library and would leave the interesting case untested.
 *
 * A checkout carries the commits it was fetched with, and the parent of the
 * newest library commit is not always one of them: a shallow clone stops at a
 * boundary whose parent was never fetched, and CI has refused `<sha>~1` for a
 * commit the checkout itself had. So which commit a range can be cut from is
 * read from the checkout rather than assumed of the newest, and the range is
 * built from the newest library commit whose parent is actually present.
 *
 * A checkout with no such commit is told which one it is missing, instead of
 * handing an unresolvable revision to Nx and surfacing several layers down as
 * an ambiguous git argument naming the range but not what is wrong with it.
 */
function rangeReachingSharedLibraries(repository = "."): [string, string] {
  const commits = execFileSync("git", ["log", "--format=%H", "--", "libs"], {
    cwd: repository,
    encoding: "utf8",
  })
    .split("\n")
    .filter((line) => /^[0-9a-f]{40}$/.test(line));
  const [newest] = commits;
  if (!newest)
    throw new Error(
      "no commit in the available history touches libs/, so lane selection cannot be proven against an affected library",
    );
  const head = commits.find((commit) =>
    resolvesToCommit(`${commit}~1`, repository),
  );
  if (!head)
    throw new Error(
      `none of the ${commits.length} commit(s) touching libs/ has its parent in this checkout, so no push range reaching a shared library can be built from it. The newest is ${newest}, whose parent ${newest}~1 is missing; deepen the checkout and rerun just test`,
    );
  return [`${head}~1`, head];
}

/**
 * A checkout whose history stops inside the library commits, which is what a
 * shallow clone hands a CI job and what this workspace's own checkout —
 * carrying its whole history — can never be. `depth` is how many commits the
 * clone keeps, so a depth of one leaves the newest library commit grafted with
 * no parent, and a deeper one leaves that parent present.
 *
 * These two are the reachable ends of the search above. A checkout missing a
 * parent partway up the library history, which is what would make that search
 * step past its first candidate, cannot be built here: git grafts a shallow
 * clone at the oldest commit it kept, so the gap is always at the bottom. That
 * step stays because CI has produced exactly that gap higher up by some means
 * this fixture cannot reproduce.
 */
function checkoutOfLibraryHistory(depth: number): string {
  const origin = mkdtempSync(join(tmpdir(), "publish-lanes-origin-"));
  const checkout = mkdtempSync(join(tmpdir(), "publish-lanes-checkout-"));
  onTestFinished(() => {
    for (const directory of [origin, checkout])
      rmSync(directory, { force: true, recursive: true });
  });
  const inOrigin = (...args: string[]) =>
    execFileSync("git", args, { cwd: origin, encoding: "utf8" });
  inOrigin("init", "--quiet", "--initial-branch=master");
  inOrigin("config", "user.email", "publish-lanes@example.test");
  inOrigin("config", "user.name", "Publish lanes fixture");
  mkdirSync(join(origin, "libs"), { recursive: true });
  for (const revision of ["first", "second", "third"]) {
    writeFileSync(
      join(origin, "libs", "shared.ts"),
      `export const shared = "${revision}";\n`,
    );
    inOrigin("add", "-A");
    inOrigin("commit", "--quiet", "-m", `feat(libs): the ${revision} revision`);
  }
  // A file:// URL rather than a path, because git only honours --depth against
  // a transport that can serve a shallow history.
  execFileSync(
    "git",
    ["clone", "--quiet", `--depth=${depth}`, `file://${origin}`, checkout],
    { encoding: "utf8" },
  );
  return checkout;
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
    const [base, head] = rangeReachingSharedLibraries();
    const affected = affectedProjects(base, head);
    const libraries = affected.filter(
      (project) => !registeredApps().includes(project),
    );
    // A range that reaches shared libraries is the interesting case: those
    // projects have build targets and are affected, but own no content-store
    // subtree, so they must not become lanes.
    expect(libraries.length).toBeGreaterThan(0);

    const lanes = publishLanes(base, head);

    expect(lanes).toEqual(
      affected.filter((project) => registeredApps().includes(project)).sort(),
    );
    for (const library of libraries) expect(lanes).not.toContain(library);
    // Two Nx graph loads in one test, which the full gate runs alongside three
    // other projects; the default 5s budget is for in-process work, not this.
  }, 180_000);

  // The range above is cut from whatever history the checkout carries, and a
  // shallow one does not carry the parent it needs. That used to reach Nx as
  // `<sha>~1` and die inside it as an ambiguous git argument, naming the range
  // but not what was wrong with it or where to fix it.
  test("a checkout without the parent it needs names the missing commit", () => {
    const checkout = checkoutOfLibraryHistory(1);
    const grafted = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: checkout,
      encoding: "utf8",
    }).trim();

    expect(() => rangeReachingSharedLibraries(checkout)).toThrow(
      `whose parent ${grafted}~1 is missing`,
    );
    expect(() => rangeReachingSharedLibraries(checkout)).toThrow(
      /none of the 1 commit\(s\) touching libs\/.*deepen the checkout/s,
    );
  }, 30_000);

  test("a checkout that carries that parent yields the range", () => {
    const checkout = checkoutOfLibraryHistory(2);
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: checkout,
      encoding: "utf8",
    }).trim();

    expect(rangeReachingSharedLibraries(checkout)).toEqual([`${head}~1`, head]);
  }, 30_000);

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
