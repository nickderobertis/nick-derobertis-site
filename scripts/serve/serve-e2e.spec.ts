import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  closeSync,
  constants,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  openSync,
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

/**
 * The e2e server started exactly as the command surface starts it, and the only
 * place in this spec that starts it. `just test-e2e` reaches this script the
 * same way: its `shell:e2e` run hands `node scripts/serve/serve-e2e.mjs` to
 * Playwright's `webServer`, so the CLI below is that command, unreplaced. Only
 * its document root moves, to the disposable tree above, because the recipe's
 * own run binds a fixed port over the workspace artifact the browser journeys
 * are mid-way through, and this spec asserts on how two runs collide over one.
 */
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
 * The same command, for the one case that never becomes a server to talk to:
 * the script claims its artifact before it listens, so a claim already held is
 * refused on stderr and the process is over. That refusal is the whole of what
 * an operator gets, and it is synchronous, which is why this run is read to
 * completion here instead of being pushed onto `children`: there is no listener
 * to reach and nothing left to shut down by the time it answers.
 */
function runServerExpectingRefusal(port: number) {
  return spawnSync(process.execPath, [serverScript], {
    cwd: workspace,
    encoding: "utf8",
    env: { ...process.env, PORT: String(port) },
    timeout: 20_000,
  });
}

/**
 * A second run reaching the compose step over the artifact this one serves,
 * run exactly as `shell:prerender` runs it. Its content store is deliberately
 * absent, so the only thing that can refuse it before it reports a missing
 * store is the claim the running server took on the directory.
 */
// llmlint: ignore-block[work_goes_through_command_surface] The CLI boundary is the subject of both runs below — the exit status and the stderr a composer answers a served artifact with, and the claim a composer holds while the server is refused — and this is the command surface the collision happens through: `shell:prerender` runs `node scripts/compose/compose.mjs` itself. The `just compose` recipe is the deploy lane's separate entry: it confines its output beneath dist/, so it cannot be pointed at the disposable tree this spec serves, and it reprints the CLI's stderr beneath its own line rather than emitting it.
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

/**
 * A real compose over the artifact this spec serves, stopped where its claim is
 * already taken and nothing is written yet.
 *
 * Compose claims its output before it reads the first published fragment, so a
 * `fragment.html` that is a FIFO with no writer leaves it blocked in that read,
 * holding the artifact for composing exactly as an overlapping gate would.
 * Nothing is timed: the write end of that FIFO cannot be opened until compose
 * has opened the read end, so the rendezvous below is what proves the claim is
 * held rather than a wait that hopes it is.
 */
function startComposeHoldingServedTree() {
  const store = path.join(tree, "composing-store");
  const stalled = path.join(store, "shell/fragment.html");
  mkdirSync(path.join(store, "shell"), { recursive: true });
  writeFileSync(path.join(store, "shell/fragment.css"), "");
  writeFileSync(path.join(store, "shell/fragment.json"), "{}");
  const named = spawnSync("mkfifo", [stalled], { encoding: "utf8" });
  if (named.status !== 0)
    throw new Error(
      `could not create ${stalled}: ${named.error?.message ?? named.stderr}`,
    );
  const child = spawn(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "scripts/compose/compose.mjs",
    ],
    {
      cwd: workspace,
      env: {
        ...process.env,
        COMPOSE_OUTPUT: path.join(tree, "dist/apps/shell"),
        FRAGMENT_ROOT: store,
      },
      stdio: "ignore",
    },
  );
  children.push(child);
  return { composing: child, stalled };
}
// llmlint: ignore-end[work_goes_through_command_surface]

/**
 * Answers with the write end of the stalled fragment once the compose above
 * owns the artifact, or throws naming what it did instead.
 *
 * Opening a FIFO for writing without blocking fails with ENXIO until a reader
 * has it open, and the only reader is the compose that already holds the
 * artifact, so the first open that succeeds is the point from which the claim
 * is certainly held. Closing what this returns is what lets that compose read
 * its way to the end and drop the claim.
 */
async function waitUntilComposing(composing: ChildProcess, stalled: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      return openSync(stalled, constants.O_WRONLY | constants.O_NONBLOCK);
    } catch {
      // The real compose has not opened its first published input yet.
    }
    if (composing.exitCode !== null)
      throw new Error(
        `compose exited with ${composing.exitCode} before claiming the served artifact`,
      );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`compose never opened ${stalled}`);
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

  // The other half of the collision: a real compose is already replacing this
  // artifact, so serving it would answer journeys out of a tree that is half of
  // two compositions. The claim is taken before anything listens, and what this
  // process prints on its way out is the whole of what an operator gets.
  it("names the run composing its artifact instead of serving one being replaced", async () => {
    const served = path.join(tree, "dist/apps/shell");
    const port = await availablePort();
    const { composing, stalled } = startComposeHoldingServedTree();
    const stalledWriter = await waitUntilComposing(composing, stalled);

    const refused = (() => {
      try {
        return runServerExpectingRefusal(port);
      } finally {
        // Compose reads its way to the end of the stalled fragment from here,
        // fails on it, and drops the claim, so nothing outlives this test.
        closeSync(stalledWriter);
      }
    })();

    expect(refused.status).toBe(1);
    // The cause: which artifact was refused, and the run that owns it.
    expect(refused.stderr).toContain(
      `Could not claim ${served} for the e2e server`,
    );
    expect(refused.stderr).toContain(
      `held by process ${composing.pid}, which is composing it`,
    );
    // The next action, in this CLI's own command surface.
    expect(refused.stderr).toContain("run just test-e2e again");
    // Nothing was served: the port it was given is still free to bind.
    const replacement = createServer();
    await new Promise<void>((resolve, reject) => {
      replacement.once("error", reject);
      replacement.listen(port, "127.0.0.1", resolve);
    });
    await new Promise<void>((resolve, reject) =>
      replacement.close((error) => (error ? reject(error) : resolve())),
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
