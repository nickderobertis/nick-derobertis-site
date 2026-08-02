import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

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

/**
 * A push range that provably reaches the shared libraries, which is the case
 * lane selection has to get right. It is derived from history rather than
 * assumed of the last commit, because a documentation-only commit affects no
 * library and would leave the interesting case untested.
 */
function rangeReachingSharedLibraries(): [string, string] {
  const head = execFileSync("git", ["log", "-1", "--format=%H", "--", "libs"], {
    encoding: "utf8",
  }).trim();
  if (!/^[0-9a-f]{40}$/.test(head))
    throw new Error(
      "no commit in the available history touches libs/, so lane selection cannot be proven against an affected library",
    );
  return [`${head}~1`, head];
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
    expect(result.stderr).not.toContain("scripts/publishable-apps.mjs");
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
    expect(result.stderr).not.toContain("node scripts/publish-fragment.mjs");
    expect(result.stdout).toBe("");
  }, 30_000);
});
