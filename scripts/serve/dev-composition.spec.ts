import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { type Browser, chromium, type Page } from "@playwright/test";
import { holdArtifactRoot } from "@site/artifact-contracts/artifact-hold";
import { composedArtifactRoot } from "@site/build-config/composed-artifact";
import {
  type RemoteProject,
  remoteRegistry,
} from "@site/build-config/remote-registry";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Module Federation composing in development mode, through each app's own
 * `serve` target — the `rspack serve` target `@nx/rspack/plugin` infers.
 *
 * Every app's development server answers for its own public path from source
 * and for everything else out of the composed artifact, on one origin. So two
 * shapes of development composition exist, and both are driven here with all
 * thirteen servers running at once, each on the port its own target declares:
 * the shell compiled from source composing every built remote, and each remote
 * compiled from source composed into the built shell that its own server hands
 * out. Either way every page is asserted the way a visitor reads it, with no
 * console error, no page error and no failed asset, and with each shared
 * singleton resolved once — one version, provided by the shell, for every
 * container on the page.
 *
 * llmlint: ignore-file[browser_journeys_run_against_the_built_app] The subject
 * of this spec is development-mode composition, so a journey against the built
 * artifact would be a journey against something else; the built artifact keeps
 * its own coverage from every app's e2e journeys, which this file leaves alone.
 */

const workspace = process.cwd();
const siteBase = "/nick-derobertis-site";

/** One remote, the route that composes it, and what a visitor reads there. */
interface Composed {
  app: string;
  route: string;
  landmark: Parameters<Page["getByRole"]>;
  /** The Primary navigation link a visitor follows to the route. */
  link?: string;
}

const routeRemotes: Composed[] = [
  {
    app: "bio",
    route: "/bio",
    link: "Bio",
    landmark: ["heading", { name: "Optimizing Life", level: 1 }],
  },
  {
    app: "research",
    route: "/research",
    link: "Research",
    landmark: ["heading", { name: "Research Works" }],
  },
  {
    app: "software",
    route: "/software",
    link: "Software",
    landmark: ["heading", { name: "Open-Source Software" }],
  },
  {
    app: "courses",
    route: "/courses",
    link: "Courses",
    landmark: ["heading", { name: "Courses", exact: true }],
  },
];

const homePanes: Composed[] = [
  {
    app: "home-carousel",
    route: "/",
    landmark: ["button", { name: "Next featured story" }],
  },
  {
    app: "home-cards",
    route: "/",
    landmark: ["region", { name: "Areas of work" }],
  },
  {
    app: "home-story",
    route: "/",
    landmark: ["region", { name: "Who am I?" }],
  },
  {
    app: "home-contact",
    route: "/",
    landmark: ["navigation", { name: "Contact options" }],
  },
  {
    app: "awards",
    route: "/",
    landmark: ["region", { name: "Selected awards" }],
  },
  { app: "skills", route: "/", landmark: ["region", { name: "Skilled in…" }] },
  {
    app: "timeline",
    route: "/",
    landmark: ["region", { name: "Educated and Experienced" }],
  },
];

// Home is the fifth route remote and the host of the seven panes. It renders
// nothing of its own, so a pane rendering on `/` is what it composing reads as.
const home: Composed = {
  app: "home",
  route: "/",
  landmark: ["region", { name: "Who am I?" }],
};
const remotes: Composed[] = [home, ...routeRemotes, ...homePanes];
const apps = ["shell", ...remotes.map((remote) => remote.app)];

/** The shared modules the build config declares singletons. */
const singletons = ["react", "react-dom"];

const serveTarget = z.object({
  targets: z.object({
    serve: z.object({
      options: z.object({ port: z.number().int().min(1).max(65_535) }),
    }),
  }),
});

/** The port an app's own serve target declares, read from its project.json. */
function declaredPort(app: string) {
  return serveTarget.parse(
    JSON.parse(readFileSync(`apps/${app}/project.json`, "utf8")),
  ).targets.serve.options.port;
}

const origin = (app: string) => `http://127.0.0.1:${declaredPort(app)}`;

/**
 * Every share scope entry for the singletons above, per container, as
 * `{ "<container>/<module>": { "<version>": "<provider>" } }`. The Module
 * Federation runtime records which container supplied each version it
 * resolved, so this is the runtime's own account rather than an inference.
 */
function sharedSingletons(page: Page) {
  return page.evaluate((names) => {
    const federation = (
      globalThis as {
        __FEDERATION__?: {
          __SHARE__?: Record<
            string,
            Record<string, Record<string, Record<string, { from: string }>>>
          >;
        };
      }
    ).__FEDERATION__;
    const resolved: Record<string, Record<string, string>> = {};
    for (const [container, scopes] of Object.entries(
      federation?.__SHARE__ ?? {},
    ))
      for (const scope of Object.values(scopes))
        for (const name of names)
          if (scope[name])
            resolved[`${container.replace(/:local$/, "")}/${name}`] =
              Object.fromEntries(
                Object.entries(scope[name]).map(([version, share]) => [
                  version,
                  share.from,
                ]),
              );
    return resolved;
  }, singletons);
}

/**
 * What went wrong on a page, from the console, the page and the network: any
 * response a server answered with 4xx or 5xx, and any request to the site's own
 * origin that failed. A request to another origin that the browser abandons
 * because the visitor moved on — a project logo still in flight when the next
 * route is followed — is the browser's cancellation, not a failed asset, so a
 * failure is held to the site's own origin.
 */
function watch(page: Page, siteOrigin: string) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) =>
    problems.push(`page error: ${error.message}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      problems.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).origin === siteOrigin)
      problems.push(`failed ${request.url()}: ${request.failure()?.errorText}`);
  });
  return problems;
}

async function expectComposed(page: Page, { landmark }: Composed) {
  const element = page.getByRole(...landmark).first();
  await element.waitFor({ timeout: 90_000 });
  expect(await element.isVisible()).toBe(true);
}

/**
 * Asserts each listed container resolved every singleton to one version,
 * supplied by the shell, and that no container on the page holds a second.
 */
async function expectSingletonsResolvedOnce(page: Page, apps: string[]) {
  const resolved = await sharedSingletons(page);
  // The runtime keys a container by its federation name, which the registry
  // maps from the app's project name; the shell is not a registered remote.
  const isRemote = (app: string): app is RemoteProject => app in remoteRegistry;
  const containers = apps.map((app) =>
    isRemote(app) ? remoteRegistry[app] : app,
  );
  for (const container of containers)
    for (const name of singletons)
      expect(
        Object.values(resolved[`${container}/${name}`] ?? {}),
        `${container} resolves ${name} once, from the shell`,
      ).toEqual(["shell"]);
  for (const [key, versions] of Object.entries(resolved))
    expect(Object.values(versions), key).toEqual(["shell"]);
}

let nx: ChildProcess | undefined;
let reported = "";
let release: (() => void) | undefined;
let browser: Browser;

async function waitUntilServing(url: string) {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (nx?.exitCode != null)
      throw new Error(
        `the serve targets exited with ${nx.exitCode} before ${url} answered: ${reported.trim()}`,
      );
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Still compiling.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${url} never answered: ${reported.trim()}`);
}

beforeAll(async () => {
  // Every server answers for everything but its own app out of the composed
  // artifact, so it is composed first, in production, as `just serve-dev`
  // composes it, and then held as read so no compose replaces it mid-journey.
  const composed = spawnSync("just", ["prerender"], {
    cwd: workspace,
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "production" },
  });
  if (composed.status !== 0)
    throw new Error(
      `just prerender failed, so there is no artifact to serve beside the app under development: ${composed.stderr}`,
    );
  release = holdArtifactRoot(`${workspace}/${composedArtifactRoot}`, "serving");
  // One Nx process runs every app's own serve target. It leads a process group
  // of its own so the teardown can interrupt it as a group; the servers it
  // starts are torn down by Nx, as the teardown below waits for.
  nx = spawn(
    "bun",
    [
      "x",
      "nx",
      "run-many",
      "-t",
      "serve",
      "-p",
      apps.join(","),
      `--parallel=${apps.length}`,
      "--output-style=stream",
    ],
    {
      cwd: workspace,
      detached: true,
      env: { ...process.env, NODE_ENV: "development", NX_DAEMON: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const stream of [nx.stdout, nx.stderr])
    stream?.on("data", (chunk: Buffer) => {
      reported = `${reported}${chunk.toString()}`.slice(-20_000);
    });
  await waitUntilServing(`${origin("shell")}${siteBase}/`);
  for (const { app } of remotes)
    await waitUntilServing(
      `${origin(app)}${siteBase}/remotes/${app}/remoteEntry.js`,
    );
  browser = await chromium.launch();
}, 1_800_000);

/** Whether anything still answers on a port. */
async function answers(url: string) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

afterAll(async () => {
  await browser?.close();
  const running = nx;
  if (running?.pid !== undefined && running.exitCode === null) {
    // Nx starts each serve task in a session of its own, so the servers are
    // not in this group; they stop when Nx is interrupted and tears them down,
    // which is waited for rather than assumed.
    const exited = new Promise((resolve) => running.once("exit", resolve));
    process.kill(-running.pid, "SIGINT");
    await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(resolve, 60_000)),
    ]);
  }
  release?.();
  const stillServing: string[] = [];
  for (const app of apps)
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (!(await answers(origin(app)))) break;
      if (attempt === 29) stillServing.push(`${app} on ${origin(app)}`);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  expect(stillServing, "every server this spec started has stopped").toEqual(
    [],
  );
}, 180_000);

describe("the shell's development server", () => {
  it("composes every route remote and Home's seven panes with React resolved once", async () => {
    const page = await browser.newPage();
    const problems = watch(page, origin("shell"));

    await page.goto(`${origin("shell")}${siteBase}/`);
    for (const pane of homePanes) await expectComposed(page, pane);
    await expectSingletonsResolvedOnce(page, [
      "shell",
      home.app,
      ...homePanes.map((pane) => pane.app),
    ]);

    // Through the shell's own navigation, as a visitor moves between routes:
    // each route remote is fetched when its link is followed.
    const primary = page.getByRole("navigation", { name: "Primary" });
    for (const remote of routeRemotes) {
      await primary
        .getByRole("link", { name: remote.link, exact: true })
        .click();
      await page.waitForURL(`**${siteBase}${remote.route}`);
      await expectComposed(page, remote);
      await expectSingletonsResolvedOnce(page, ["shell", remote.app]);
    }

    // The document is the one the shell's development compilation built: it
    // names an unhashed entry, where every published document names a hash.
    const document = await (
      await fetch(`${origin("shell")}${siteBase}/`)
    ).text();
    expect(document).toMatch(/<script[^>]+src="[^"]*\/main\.js"/);
    expect(problems).toEqual([]);
    await page.close();
  }, 600_000);
});

describe("each remote's own development server", () => {
  it.each(remotes)(
    "composes $app's development build into the site",
    async (remote) => {
      const page = await browser.newPage();
      const problems = watch(page, origin(remote.app));

      await page.goto(`${origin(remote.app)}${siteBase}${remote.route}`);
      await expectComposed(page, remote);
      await expectSingletonsResolvedOnce(page, ["shell", remote.app]);

      // The container this server hands out is its development build, which
      // carries source maps; the published one carries none.
      const container = await (
        await fetch(
          `${origin(remote.app)}${siteBase}/remotes/${remote.app}/remoteEntry.js`,
        )
      ).text();
      expect(container).toContain("sourceMappingURL");
      expect(problems).toEqual([]);
      await page.close();
    },
    300_000,
  );
});
