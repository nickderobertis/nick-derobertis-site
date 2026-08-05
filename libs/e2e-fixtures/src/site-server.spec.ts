import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSiteServer, type SiteServerOptions } from "./site-server.ts";

// The server every browser journey and every visual capture is served through,
// driven here over real HTTP against a real artifact tree on disk.

const base = "/nick-derobertis-site";
const lazyAssetLatencyMs = 250;
const servers: Server[] = [];
const roots: string[] = [];

async function artifact() {
  const root = await mkdtemp(join(tmpdir(), "site-server-"));
  roots.push(root);
  await mkdir(join(root, "bio"), { recursive: true });
  await mkdir(join(root, "remotes/bio"), { recursive: true });
  await mkdir(join(root, "cv-data/domains"), { recursive: true });
  await Promise.all([
    writeFile(join(root, "index.html"), "<h1>home document</h1>"),
    writeFile(join(root, "404.html"), "<h1>recovery document</h1>"),
    writeFile(join(root, "bio/index.html"), "<h1>bio route</h1>"),
    writeFile(join(root, "remotes/bio/index.html"), "<h1>bio remote</h1>"),
    writeFile(join(root, "remotes/bio/main.abc123.js"), "//eager\n"),
    writeFile(join(root, "remotes/bio/pane.def456.js"), "//lazy\n"),
    writeFile(
      join(root, "cv-data/domains/research.json"),
      JSON.stringify({ projects: [{ title: "published research" }] }),
    ),
    writeFile(join(root, "cv-data/domains/awards.json"), JSON.stringify([1])),
  ]);
  return root;
}

async function serve(options: Omit<SiteServerOptions, "base">) {
  const server = createSiteServer({ base, ...options });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("the site server did not report a listening port");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        }),
    ),
  );
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("the Pages-base site server", () => {
  it("serves a route document and its directory index beneath the base path", async () => {
    const root = await artifact();
    const origin = await serve({ root, notFound: { file: "404.html" } });

    const home = await fetch(`${origin}${base}/`);
    const route = await fetch(`${origin}${base}/bio`);

    expect(home.headers.get("content-type")).toBe("text/html");
    expect(await home.text()).toContain("home document");
    expect(await route.text()).toContain("bio route");
  });

  it("answers an unknown path with the recovery document", async () => {
    const root = await artifact();
    const origin = await serve({ root, notFound: { file: "404.html" } });

    const missing = await fetch(`${origin}${base}/no-such-route`);

    expect(missing.headers.get("content-type")).toBe("text/html");
    expect(await missing.text()).toContain("recovery document");
  });

  it("refuses a path that climbs out of the served root", async () => {
    const root = await artifact();
    const origin = await serve({
      root,
      route: () => ({ root: join(root, "remotes/bio"), relative: "../../.." }),
    });

    const escaped = await fetch(`${origin}${base}/remotes/bio/anything`);

    expect(escaped.status).toBe(404);
    expect(await escaped.text()).toBe("Not found");
  });

  it("holds a remote's lazy chunk without delaying its eager entry", async () => {
    const root = await artifact();
    const origin = await serve({ root, lazyAssetLatencyMs });

    const started = process.hrtime.bigint();
    await fetch(`${origin}${base}/remotes/bio/main.abc123.js`);
    const eagerMs = Number(process.hrtime.bigint() - started) / 1e6;
    const lazyStarted = process.hrtime.bigint();
    const lazy = await fetch(`${origin}${base}/remotes/bio/pane.def456.js`);
    const lazyMs = Number(process.hrtime.bigint() - lazyStarted) / 1e6;

    expect(lazy.headers.get("content-type")).toBe("text/javascript");
    expect(lazyMs).toBeGreaterThanOrEqual(lazyAssetLatencyMs);
    expect(eagerMs).toBeLessThan(lazyAssetLatencyMs);
  });

  it("routes each remote to its own document root and refuses an unknown one", async () => {
    const root = await artifact();
    const remotes = new Map([["bio", join(root, "remotes/bio")]]);
    const origin = await serve({
      root,
      route: (url) => {
        const match = new RegExp(`^${base}/remotes/([a-z-]+)/(.*)$`).exec(
          url.pathname,
        );
        if (!match) return undefined;
        const [, name = "", relative = ""] = match;
        const remoteRoot = remotes.get(name);
        return remoteRoot
          ? { root: remoteRoot, relative: relative || "index.html" }
          : { status: 400, body: "Unknown visual project" };
      },
    });

    const known = await fetch(`${origin}${base}/remotes/bio/`);
    const unknown = await fetch(`${origin}${base}/remotes/absent/`);

    expect(await known.text()).toContain("bio remote");
    expect(unknown.status).toBe(400);
    expect(await unknown.text()).toBe("Unknown visual project");
  });

  it("steers the CV-data domains through every journey scenario", async () => {
    const root = await artifact();
    const origin = await serve({ root, dataLoadingMs: 120 });
    const domain = `${origin}${base}/cv-data/domains/research.json`;

    const happy = await fetch(domain);
    const empty = await fetch(`${domain}?scenario=empty`);
    const failed = await fetch(`${domain}?scenario=error`);
    const unsupported = await fetch(`${domain}?scenario=nonsense`);
    const started = process.hrtime.bigint();
    const loading = await fetch(`${domain}?scenario=loading`);
    const loadingMs = Number(process.hrtime.bigint() - started) / 1e6;

    expect(await happy.json()).toEqual({
      projects: [{ title: "published research" }],
    });
    expect(await empty.json()).toEqual({ projects: [] });
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: "research unavailable" });
    expect(unsupported.status).toBe(400);
    expect(loadingMs).toBeGreaterThanOrEqual(120);
    expect(await loading.json()).toEqual({
      projects: [{ title: "published research" }],
    });
  });

  it("reports a domain whose fixture the artifact does not carry", async () => {
    const root = await artifact();
    await rm(join(root, "cv-data/domains/awards.json"));
    const origin = await serve({ root });

    const missing = await fetch(`${origin}${base}/cv-data/domains/awards.json`);

    expect(missing.status).toBe(500);
    expect(await missing.json()).toEqual({
      error: "awards fixture unavailable",
    });
  });
});
