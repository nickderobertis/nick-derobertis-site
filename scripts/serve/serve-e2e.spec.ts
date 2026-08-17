import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

const workspace = path.resolve(import.meta.dirname, "../..");
const addressSchema = z.object({
  port: z.number().int().min(1).max(65_535),
});
const children: ChildProcess[] = [];
let serverScript: string;
let tree: string;

/**
 * The real CLI over an artifact this spec owns. serve-e2e resolves its document
 * root beside itself, so the script's own bytes are placed in a disposable tree
 * that carries a small built site and links back to the workspace libraries it
 * imports. Nothing about the CLI is replaced, and the shell's real prerendered
 * artifact stays the Playwright integration suite's subject rather than a build
 * this project's tests have to wait for.
 */
beforeAll(() => {
  tree = mkdtempSync(path.join(tmpdir(), "serve-e2e-"));
  mkdirSync(path.join(tree, "scripts/serve"), { recursive: true });
  mkdirSync(path.join(tree, "dist/apps/shell"), { recursive: true });
  symlinkSync(path.join(workspace, "libs"), path.join(tree, "libs"));
  serverScript = path.join(tree, "scripts/serve/serve-e2e.mjs");
  copyFileSync(
    path.join(workspace, "scripts/serve/serve-e2e.mjs"),
    serverScript,
  );
  writeFileSync(
    path.join(tree, "dist/apps/shell/index.html"),
    '<!doctype html><html lang="en"><head><title>served site</title></head><body><header>Nick DeRobertis</header><main>route content</main></body></html>',
  );
  writeFileSync(
    path.join(tree, "dist/apps/shell/404.html"),
    '<!doctype html><html lang="en"><head><title>Not found</title></head><body><header>Nick DeRobertis</header><p>Loading requested page</p></body></html>',
  );
});

afterAll(() => {
  rmSync(tree, { force: true, recursive: true });
});

async function availablePort() {
  const reservation = createServer();
  await new Promise<void>((resolve) =>
    reservation.listen(0, "127.0.0.1", resolve),
  );
  const { port } = addressSchema.parse(reservation.address());
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function waitUntilReady(url: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The real server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`serve-e2e did not become ready at ${url}`);
}

function startServer(port: number) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: workspace,
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  children.push(child);
  return child;
}

/**
 * A second run reaching the compose step over the artifact this one serves,
 * run exactly as `shell:prerender` runs it. Its content store is deliberately
 * absent, so the only thing that can refuse it before it reports a missing
 * store is the claim the running server took on the directory.
 */
// llmlint: ignore[work_goes_through_command_surface] This is the command surface the collision happens through: `shell:prerender` runs `node scripts/compose/compose.mjs` itself, and the `just compose` recipe is the deploy lane's separate entry, which confines its output beneath dist/ and so cannot be pointed at the disposable tree this spec serves.
function composeOverServedTree() {
  return spawnSync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "scripts/compose/compose.mjs",
    ],
    {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        COMPOSE_OUTPUT: path.join(tree, "dist/apps/shell"),
        FRAGMENT_ROOT: path.join(tree, "no-content-store"),
      },
    },
  );
}

describe("serve-e2e lifecycle", () => {
  afterEach(async () => {
    await Promise.all(
      children.splice(0).map(async (child) => {
        if (child.exitCode !== null) return;
        const exited = once(child, "exit");
        child.kill("SIGTERM");
        await exited;
      }),
    );
  });

  it.each<NodeJS.Signals>(["SIGTERM", "SIGINT"])(
    "releases its listening port after %s",
    async (shutdownSignal) => {
      const port = await availablePort();
      const child = startServer(port);
      const url = `http://127.0.0.1:${port}/nick-derobertis-site/`;
      await waitUntilReady(url);
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto(url);
        expect(await page.getByRole("banner").isVisible()).toBe(true);
      } finally {
        await browser.close();
      }
      const exited = once(child, "exit");
      expect(child.kill(shutdownSignal)).toBe(true);
      const [exitCode, signal] = await exited;
      expect(exitCode).toBe(0);
      expect(signal).toBeNull();

      const replacement = createServer();
      await new Promise<void>((resolve, reject) => {
        replacement.once("error", reject);
        replacement.listen(port, "127.0.0.1", resolve);
      });
      await new Promise<void>((resolve, reject) =>
        replacement.close((error) => (error ? reject(error) : resolve())),
      );
    },
    30_000,
  );

  // `nx affected -t e2e --parallel=3` serves this one composed artifact from
  // several apps' runs at once, so holding it as a reader has to stay shared.
  it("serves one artifact from every run an affected dispatch starts", async () => {
    const ports = [await availablePort(), await availablePort()];
    for (const port of ports) startServer(port);

    for (const port of ports) {
      const url = `http://127.0.0.1:${port}/nick-derobertis-site/`;
      await waitUntilReady(url);
      expect((await fetch(url)).ok).toBe(true);
    }
  }, 30_000);

  // A compose removes and restages the route documents, `cv-data`, and
  // `remotes` in place, so one running beside this server would answer a
  // journey from a tree that is half of two compositions.
  it("claims its artifact so a second run's compose refuses instead of replacing it", async () => {
    const port = await availablePort();
    const child = startServer(port);
    await waitUntilReady(`http://127.0.0.1:${port}/nick-derobertis-site/`);

    const refused = composeOverServedTree();

    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toContain(
      `held by process ${child.pid}, which is serving it`,
    );

    // Released on shutdown: the claim outlives no run, so the next compose over
    // this artifact reaches its own inputs and reports on those instead.
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
    expect(composeOverServedTree().stderr).toContain(
      "Could not read the published shell fragment",
    );
  }, 30_000);

  it("answers an unrouted path with the artifact's recovery document", async () => {
    const port = await availablePort();
    startServer(port);
    const base = `http://127.0.0.1:${port}/nick-derobertis-site`;
    await waitUntilReady(`${base}/`);

    const missing = await fetch(`${base}/no-such-route`);

    expect(missing.headers.get("content-type")).toBe("text/html");
    expect(await missing.text()).toContain("Loading requested page");
  }, 30_000);
});
