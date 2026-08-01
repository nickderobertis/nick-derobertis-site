import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// The affected-only economics of the Pages deploy. `.github/workflows/pages.yml`
// asks exactly one question — `just publish-lanes` for a manual dispatch that
// seeds every lane, `just publish-lanes <base> <head>` for a push — and feeds the
// answer straight into its `publish` matrix. These tests drive that same command
// surface, so an affected library is never a lane and an unaffected app is never
// rebuilt, republished, or redeployed.

function publishLanes(...range: string[]): string[] {
  const output = execFileSync("just", ["publish-lanes", ...range], {
    encoding: "utf8",
  });
  const lanes: unknown = JSON.parse(output);
  if (
    !Array.isArray(lanes) ||
    !lanes.every(
      (lane) => typeof lane === "string" && /^[a-z][a-z0-9-]*$/.test(lane),
    )
  )
    throw new Error("just publish-lanes did not emit a list of project names");
  return lanes;
}

function affectedProjects(...range: string[]): string[] {
  return JSON.parse(
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
      { encoding: "utf8" },
    ),
  );
}

function registeredApps(): string[] {
  const manifest: unknown = JSON.parse(
    readFileSync("libs/build-config/src/remotes.json", "utf8"),
  );
  if (!manifest || typeof manifest !== "object")
    throw new Error("the remote registry must be an object");
  return ["shell", ...Object.keys(manifest)].sort();
}

describe("publish lane selection", () => {
  test("a manual dispatch seeds every registered app's lane", () => {
    expect(publishLanes()).toEqual(registeredApps());
  });

  test("a push range publishes only apps, never the libraries it also affects", () => {
    const affected = affectedProjects("HEAD~1", "HEAD");
    const libraries = affected.filter(
      (project) => !registeredApps().includes(project),
    );
    // A range that reaches shared libraries is the interesting case: those
    // projects have build targets and are affected, but own no content-store
    // subtree, so they must not become lanes.
    expect(libraries.length).toBeGreaterThan(0);

    const lanes = publishLanes("HEAD~1", "HEAD");

    expect(lanes).toEqual(
      affected.filter((project) => registeredApps().includes(project)).sort(),
    );
    for (const library of libraries) expect(lanes).not.toContain(library);
  });

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
  });

  test("a range git would read as an option is refused before it reaches git", () => {
    const result = spawnSync("just", ["publish-lanes", "--all", "HEAD"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(
      /publish-lanes: base and head must resolve to commits/,
    );
    expect(result.stdout).toBe("");
  });

  test("an unrecognized argument is refused rather than read as no lanes", () => {
    const result = spawnSync("node", ["scripts/publishable-apps.mjs", "--al"], {
      encoding: "utf8",
      input: "",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /publishable-apps: the only accepted argument is --all/,
    );
    expect(result.stdout).toBe("");
  });

  // `just build-app` is what a publish lane runs, and a lane may build only a
  // project that owns a content-store subtree. A buildable library is a valid
  // Nx build target and would otherwise slip through.
  test("build-app refuses a buildable library that owns no publish lane", () => {
    const library: unknown = JSON.parse(
      readFileSync("libs/design-system/project.json", "utf8"),
    );
    expect(
      (library as { targets: Record<string, unknown> }).targets,
    ).toHaveProperty("build");
    expect(registeredApps()).not.toContain("design-system");

    const result = spawnSync("just", ["build-app", "design-system"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(
      /build-app: app must name a publish lane.*owns no content-store subtree/s,
    );
  });

  test("a selection that is not a list of project names is refused", () => {
    const result = spawnSync("node", ["scripts/publishable-apps.mjs"], {
      encoding: "utf8",
      input: '["Awards", 3]',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /publishable-apps:.*JSON array of Nx project names/,
    );
    expect(result.stdout).toBe("");
  });
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
    expect(JSON.parse(result.stdout)).toEqual(registeredApps());
  });

  test("a refused build names the fix without echoing the recipe body", () => {
    const result = spawnSync("just", ["build-app", "design-system"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/^build-app: app must name a publish lane/);
    expect(result.stderr).not.toContain("scripts/publishable-apps.mjs");
    expect(result.stderr).not.toContain("mktemp");
  });

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
  });
});
