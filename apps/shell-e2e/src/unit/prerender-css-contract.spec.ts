import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// The prerender step and the artifact check both resolve a route's inlined page
// CSS through scripts/remote-css.mjs. That plain-Node tooling lives outside the
// TypeScript projects, so this drift gate queries the real module the way the
// build does: as a subprocess.
function queryRouteRemotes(routePath: string) {
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'const { remotesForRoute } = await import("./scripts/remote-css.mjs");\nprocess.stdout.write(JSON.stringify(remotesForRoute(process.argv[1])));',
      routePath,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
}

function routeRemotes(routePath: string) {
  const result = queryRouteRemotes(routePath);
  expect(result.stderr, routePath).toBe("");
  expect(result.status, routePath).toBe(0);
  return JSON.parse(result.stdout) as string[];
}

interface RouteRecord {
  path: string;
  remote?: string;
}

async function shellRoutes() {
  const parsed: unknown = JSON.parse(
    await readFile("apps/shell/src/routes.json", "utf8"),
  );
  if (
    !Array.isArray(parsed) ||
    parsed.some(
      (route) =>
        !route || typeof route !== "object" || typeof route.path !== "string",
    )
  )
    throw new Error("Validated shell routes are required");
  return parsed as RouteRecord[];
}

async function homeComposedRemotes() {
  const config = await readFile("apps/home/rspack.config.ts", "utf8");
  const declared = /remoteMap\(\[([^\]]*)\]\)/.exec(config)?.[1];
  if (!declared)
    throw new Error("apps/home/rspack.config.ts must declare its remoteMap");
  return [...declared.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

describe("prerendered route CSS contract", () => {
  it("inlines the home host's CSS and every pane it composes", async () => {
    expect(routeRemotes("/")).toEqual([
      "home",
      ...(await homeComposedRemotes()),
    ]);
  });

  it("inlines each leaf route's own remote CSS", async () => {
    const leaves = (await shellRoutes()).filter((route) => route.path !== "/");

    expect(leaves.length).toBeGreaterThan(0);
    for (const route of leaves)
      expect(routeRemotes(route.path), route.path).toEqual([route.remote]);
  });

  it("rejects a route with no declared page CSS", () => {
    const result = queryRouteRemotes("/unknown");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("scripts/remote-css.mjs");
  });
});
