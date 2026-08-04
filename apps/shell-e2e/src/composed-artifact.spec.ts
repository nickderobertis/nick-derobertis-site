import { spawnSync } from "node:child_process";
import { createReadStream, readFileSync } from "node:fs";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { expect, type Page, test } from "@playwright/test";
// The Pages base and the route inventory each have one validated source; this
// spec reads them rather than restating either contract. The e2e tag policy
// governs application code, so reading those two contracts is exempted here.
/* eslint-disable @nx/enforce-module-boundaries */
import { siteBase } from "@site/data-access-core";
import { parseSiteRoutes } from "@site/route-state";

/* eslint-enable @nx/enforce-module-boundaries */

/**
 * The deploy lane never serves an app's build directory. It checks out the
 * content-store branch, composes `apps/<name>/` subtrees into a fresh output
 * directory, and uploads that. Every other journey in this suite serves
 * `dist/apps/shell`, where the shell's bundle already sits next to the composed
 * documents, so none of them can see an artifact that ships documents without
 * the bytes they reference. This spec drives that CI topology instead.
 */
const contentStore = "dist/e2e-content-store/apps";
const composedSite = "dist/e2e-composed-site";

const base = siteBase;
const routePaths = parseSiteRoutes(
  JSON.parse(readFileSync("apps/shell/src/routes.json", "utf8")),
).map(({ path }) => path);

/**
 * Rebuilds the content store the publish lanes leave behind: one directory per
 * app holding exactly that app's build output. A publish lane runs
 * `nx run <app>:build` and nothing else, so its subtree never contains a
 * composition. Locally the shell's build directory doubles as the default
 * compose output, so the entries a previous compose wrote there are dropped
 * here to restore the published shape.
 */
async function writeContentStore() {
  const composed = new Set([
    "404.html",
    "cv-data",
    "remotes",
    ...routePaths.filter((path) => path !== "/").map((path) => path.slice(1)),
  ]);
  await rm("dist/e2e-content-store", { recursive: true, force: true });
  for (const app of await readdir("dist/apps", { withFileTypes: true })) {
    if (!app.isDirectory()) continue;
    const source = join("dist/apps", app.name);
    const destination = join(contentStore, app.name);
    await mkdir(destination, { recursive: true });
    for (const entry of await readdir(source, { withFileTypes: true })) {
      if (app.name === "shell" && composed.has(entry.name)) continue;
      await cp(join(source, entry.name), join(destination, entry.name), {
        recursive: true,
      });
    }
  }
}

const contentTypes: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
};

/**
 * Serves the composed artifact the way GitHub Pages serves a project site:
 * static bytes under the project base path, directories resolved to their
 * `index.html`, and an unknown path answered with the artifact's own 404
 * document and a 404 status. Nothing here fills a gap in the artifact, which is
 * the point — a document that references bytes compose failed to stage gets the
 * 404 a visitor would get.
 *
 * `scripts/serve/serve-e2e.mjs` is deliberately not reused: it serves the shell's
 * build directory, answers a missing file with the fallback under a 200, and
 * injects the data scenarios and latency the feature journeys need. Every one
 * of those would hide the defect this spec exists to catch.
 */
function startArtifactServer(root: string) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) {
      response.writeHead(404).end();
      return;
    }
    const relative = normalize(url.pathname.slice(base.length)).replace(
      /^(?:\.\.[/\\])+/,
      "",
    );
    let file = join(root, relative);
    let status = 200;
    try {
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      await stat(file);
    } catch {
      file = join(root, "404.html");
      status = 404;
    }
    response.writeHead(status, {
      "Content-Type": contentTypes[extname(file)] ?? "application/octet-stream",
    });
    createReadStream(file).pipe(response);
  });
  return new Promise<Server>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/**
 * The browser probes `/favicon.ico` on its own for every navigation. The shell
 * build publishes no favicon, so that probe is not a reference the artifact
 * owes and its 404 is not a broken asset.
 */
function isBrowserFaviconProbe(url: string) {
  return new URL(url).pathname === "/favicon.ico";
}

function recordFailedRequests(page: Page) {
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400 && !isBrowserFaviconProbe(response.url()))
      failures.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    if (!isBrowserFaviconProbe(request.url()))
      failures.push(
        `${request.failure()?.errorText ?? "failed"} ${request.url()}`,
      );
  });
  return failures;
}

/**
 * Reports when the artifact has stopped fetching. A document reaches
 * `networkidle` once, and the fetches that matter most here start after it: a
 * host remote asks for its children only once its own bundle has run, so
 * Home's seven panes are still arriving when the initial idle window closes.
 * A test that navigates or asserts at that moment cancels those requests and
 * records its own aborts as artifact failures, while a chunk the artifact
 * really lacks never gets to answer 404. Install this before a navigation and
 * await the returned settle after it.
 */
function watchTraffic(page: Page) {
  let inFlight = 0;
  let settled = 0;
  const started = () => {
    inFlight += 1;
  };
  const finished = () => {
    inFlight -= 1;
    settled += 1;
  };
  page.on("request", started);
  page.on("requestfinished", finished);
  page.on("requestfailed", finished);
  return async () => {
    // The document itself must have been fetched at all…
    await expect.poll(() => settled).toBeGreaterThan(0);
    // …and then the page must stay quiet long enough for the fetches hydration
    // starts to have started, so this reports the whole load rather than its
    // first leg.
    await expect
      .poll(async () => {
        const before = settled;
        await page.waitForTimeout(500);
        return inFlight === 0 && settled === before;
      })
      .toBe(true);
    page.off("request", started);
    page.off("requestfinished", finished);
    page.off("requestfailed", finished);
  };
}

let server: Server;
let origin: string;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  await writeContentStore();
  await rm(composedSite, { recursive: true, force: true });
  // The deploy lane's whole command surface, run exactly as pages.yml runs it.
  const composed = spawnSync("just", ["compose", contentStore, composedSite], {
    encoding: "utf8",
  });
  expect(
    composed.status,
    `${composed.stdout ?? ""}${composed.stderr ?? ""}`,
  ).toBe(0);
  server = await startArtifactServer(composedSite);
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Artifact server did not listen on a TCP socket");
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

for (const routePath of routePaths)
  test(`the composed deploy artifact serves every asset ${routePath} references`, async ({
    page,
  }) => {
    const failures = recordFailedRequests(page);
    const served = new Set<string>();
    page.on("response", (response) => {
      if (response.status() === 200)
        served.add(extname(new URL(response.url()).pathname));
    });
    const settle = watchTraffic(page);

    await page.goto(`${origin}${base}${routePath}`, {
      waitUntil: "networkidle",
    });
    await settle();

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    expect(failures).toEqual([]);
    // A document whose bundle is missing still paints its prerendered markup,
    // so the served asset kinds are what separate a complete artifact from the
    // markup-only one this topology shipped.
    expect([...served]).toEqual(expect.arrayContaining([".js", ".css"]));
  });

test("the composed deploy artifact hydrates and navigates without a document request", async ({
  page,
}) => {
  const failures = recordFailedRequests(page);
  const entered = watchTraffic(page);
  await page.goto(`${origin}${base}/`, { waitUntil: "networkidle" });
  // Home's panes are fetched by its bundle, so waiting for them to arrive is
  // also what puts hydration behind this click: an unhydrated document answers
  // the header link with a document request, which is exactly what is asserted
  // against below.
  await entered();
  await expect(
    page.getByRole("heading", { name: "Finance researcher & educator" }),
  ).toBeVisible();

  let documentRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest()) documentRequests += 1;
  });
  const navigated = watchTraffic(page);
  await page.getByRole("link", { name: "Bio", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Optimizing Life" }),
  ).toBeVisible();
  await navigated();
  expect(documentRequests).toBe(0);
  expect(failures).toEqual([]);
});

test("the composed deploy artifact serves each standalone remote document", async ({
  page,
}) => {
  const failures = recordFailedRequests(page);
  for (const name of await readdir(join(composedSite, "remotes"))) {
    const settle = watchTraffic(page);
    await page.goto(`${origin}${base}/remotes/${name}/`, {
      waitUntil: "networkidle",
    });
    await settle();
    // Awards and Home prerender no heading of their own — one resolves its
    // data after hydration and the other is a host of slots — so a visible
    // heading on every remote is also proof its bundle ran.
    await expect(page.getByRole("heading").first()).toBeVisible();
    expect(failures, `${name} standalone`).toEqual([]);
  }
});
