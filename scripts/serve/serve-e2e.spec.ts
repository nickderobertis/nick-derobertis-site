import { type ChildProcess, spawn } from "node:child_process";
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
/* eslint-disable-next-line @nx/enforce-module-boundaries -- This spec claims the artifact by the same direct source path Node type stripping resolves for the CLI, which cannot resolve a tsconfig alias into a library that is not a workspace package. */
import { holdArtifactRoot } from "../../libs/artifact-contracts/src/artifact-hold.ts";

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

function startServer(port: number, stdio: "ignore" | "pipe" = "ignore") {
  const child = spawn(process.execPath, [serverScript], {
    cwd: workspace,
    env: { ...process.env, PORT: String(port) },
    stdio,
  });
  children.push(child);
  return child;
}

/** Everything the CLI reported before it gave up, as a supervising run sees it. */
async function diagnostics(child: ChildProcess) {
  let reported = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    reported += chunk.toString();
  });
  const [exitCode] = await once(child, "exit");
  return { exitCode, reported };
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

  // The other half of the same hold: a compose replaces the route documents,
  // `cv-data`, and `remotes` in place, so a server started midway through one
  // would answer from a tree that is half two compositions.
  it("refuses to serve an artifact another run is composing", async () => {
    const release = holdArtifactRoot(
      path.join(tree, "dist/apps/shell"),
      "composing",
    );

    try {
      const { exitCode, reported } = await diagnostics(
        startServer(await availablePort(), "pipe"),
      );

      expect(exitCode).toBe(1);
      expect(reported).toContain(
        `held by process ${process.pid}, which is composing it`,
      );
    } finally {
      release();
    }
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
