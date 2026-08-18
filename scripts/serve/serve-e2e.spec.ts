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
// This spec drives serve-e2e.mjs itself, which Node type-strips, so it reaches
// the same library module by the same path the CLI resolves. Only a library
// published as a workspace package resolves by alias there.
/* eslint-disable @nx/enforce-module-boundaries -- This CLI integration spec follows the same direct source path used by Node type stripping, which cannot resolve a tsconfig alias into a library that is not a workspace package. */
import { holdArtifactRoot } from "../../libs/artifact-contracts/src/artifact-hold.ts";

/* eslint-enable @nx/enforce-module-boundaries */

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
// llmlint: ignore-block[work_goes_through_command_surface] The CLI boundary is the subject here — the exit status and the stderr the composer answers a served artifact with — and this is the command surface the collision happens through: `shell:prerender` runs `node scripts/compose/compose.mjs` itself. The `just compose` recipe is the deploy lane's separate entry: it confines its output beneath dist/, so it cannot be pointed at the disposable tree this spec serves, and it reprints the CLI's stderr beneath its own line rather than emitting it.
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
// llmlint: ignore-end[work_goes_through_command_surface]

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

  // The other half of the collision: a compose is already replacing this
  // artifact, so serving it would answer journeys out of a tree that is half of
  // two compositions. The claim is taken before anything listens, and what this
  // process prints on its way out is the whole of what an operator gets.
  it("names the run composing its artifact instead of serving one being replaced", async () => {
    const served = path.join(tree, "dist/apps/shell");
    const port = await availablePort();
    // llmlint: ignore[tests_mirror_real_usage] This is the entry point the compose CLI itself claims through — compose.mjs calls this exported function with this activity, and the record it writes is byte-identical to the one a real compose leaves. It cannot be produced by running compose here: a compose holds only while it runs and releases before it exits, so there is no moment at which a real one is still composing when the server starts. The subject of the case, serve-e2e, is the real CLI in a real process throughout.
    const release = holdArtifactRoot(served, "composing");

    const refused = (() => {
      try {
        return spawnSync(process.execPath, [serverScript], {
          cwd: workspace,
          encoding: "utf8",
          env: { ...process.env, PORT: String(port) },
          timeout: 20_000,
        });
      } finally {
        release();
      }
    })();

    expect(refused.status).toBe(1);
    // The cause: which artifact was refused, and the run that owns it.
    expect(refused.stderr).toContain(
      `Could not claim ${served} for the e2e server`,
    );
    expect(refused.stderr).toContain(
      `held by process ${process.pid}, which is composing it`,
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
