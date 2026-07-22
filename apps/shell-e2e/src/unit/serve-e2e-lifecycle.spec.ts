import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

const workspace = path.resolve(import.meta.dirname, "../../../..");
const serverScript = path.join(workspace, "scripts/serve-e2e.mjs");
const addressSchema = z.object({
  port: z.number().int().min(1).max(65_535),
});
const children: ChildProcess[] = [];

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

  it("releases its listening port after SIGTERM", async () => {
    const port = await availablePort();
    const child = spawn(process.execPath, [serverScript], {
      cwd: workspace,
      env: { ...process.env, PORT: String(port) },
      stdio: "ignore",
    });
    children.push(child);
    const url = `http://127.0.0.1:${port}/nick-derobertis-site/`;
    await waitUntilReady(url);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(url);
      expect(await page.locator("header").isVisible()).toBe(true);
    } finally {
      await browser.close();
    }
    const exited = once(child, "exit");
    expect(child.kill("SIGTERM")).toBe(true);
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
  }, 10_000);
});
