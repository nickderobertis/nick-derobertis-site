import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { type Browser, chromium, type Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * The development server, driven exactly as a contributor starts it.
 *
 * `just serve` builds all thirteen apps in production mode and serves the
 * composed artifact, so a one-line change costs that whole rebuild and a
 * restart. `just serve-dev <app>` serves one app from source instead, with
 * every other app answered for out of that same built artifact, and both
 * halves on one origin at the Pages base path — which is what leaves a
 * production build alone, since the remote URLs it emits are origin-relative
 * and resolve against this server unchanged.
 *
 * Nothing below inspects configuration. Each case starts the real recipe as a
 * subprocess — which validates its app, claims the artifact and starts the
 * server through `scripts/serve/serve-dev.mjs` — opens what it serves in a real
 * browser, edits a real source file of the app under development, and waits for
 * the running page to show it.
 */

const workspace = process.cwd();
const addressSchema = z.object({ port: z.number().int().min(1).max(65_535) });

/** The running recipe, and everything it has said about itself so far. */
interface StartedRecipe {
  recipe: ChildProcess;
  reported: string[];
}

/** A source file this spec edits, and the edit it makes to it. */
interface Edit {
  file: string;
  anchor: string;
  addition: string;
}

const probe = '<p data-testid="hmr-probe">hot module replacement probe</p>';

const hostEdit: Edit = {
  file: "apps/shell/src/site-root.tsx",
  anchor: "      <Outlet />",
  addition: `      ${probe}\n      <Outlet />`,
};

const paneEdit: Edit = {
  file: "apps/awards/src/page.tsx",
  anchor: '      <h2 className="visually-hidden">{label}</h2>',
  addition: `      <h2 className="visually-hidden">{label}</h2>\n      ${probe}`,
};

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

/**
 * The recipe, started in its own process group.
 *
 * `just serve-dev` is a chain — just, the CLI it runs, the Nx target that runs
 * the server — so signalling the process this spec started would leave the
 * server listening. Its own group is what makes stopping it stop all of it, and
 * every process in that group is one this spec started.
 */
function startRecipe(app: string, port: number) {
  const recipe = spawn("just", ["serve-dev", app], {
    cwd: workspace,
    detached: true,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // A recipe that never serves has already said why, and it says it on the way
  // out, so what it reported is kept for the failure below rather than dropped.
  const reported: string[] = [];
  for (const stream of [recipe.stdout, recipe.stderr])
    stream?.on("data", (chunk: Buffer) => reported.push(chunk.toString()));
  return { recipe, reported };
}

function stopRecipe({ recipe }: StartedRecipe) {
  if (recipe.pid === undefined) return;
  try {
    process.kill(-recipe.pid, "SIGTERM");
  } catch {
    // Already gone: the recipe failed before it started a server.
  }
}

/**
 * Waits for the recipe to build every app and answer for the page under test.
 * The ceiling is generous because the first start builds all thirteen apps from
 * a cold Nx cache, which is the recipe doing what it promises rather than
 * hanging.
 */
async function waitUntilServed(
  url: string,
  { recipe, reported }: StartedRecipe,
) {
  for (let attempt = 0; attempt < 900; attempt += 1) {
    if (recipe.exitCode !== null)
      throw new Error(
        `just serve-dev exited with ${recipe.exitCode} before serving ${url}: ${reported.join("").trim()}`,
      );
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The recipe is still building the artifact its siblings come from.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(
    `just serve-dev never served ${url}: ${reported.join("").trim()}`,
  );
}

/** Applies an edit to a real source file, and answers with its restore. */
function edit({ file, anchor, addition }: Edit) {
  const original = readFileSync(file, "utf8");
  if (!original.includes(anchor))
    throw new Error(
      `${file} no longer contains ${JSON.stringify(anchor)}, so this spec would edit nothing. Point it at source the app still renders.`,
    );
  writeFileSync(file, original.replace(anchor, addition));
  return () => writeFileSync(file, original);
}

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

describe("the host served from source", () => {
  let started: StartedRecipe;
  let base: string;
  let page: Page;

  beforeAll(async () => {
    const port = await availablePort();
    base = `http://127.0.0.1:${port}/nick-derobertis-site`;
    started = startRecipe("shell", port);
    await waitUntilServed(`${base}/`, started);
    page = await browser.newPage();
  }, 1_800_000);

  afterAll(() => stopRecipe(started));

  it("renders the site from source with every sibling remote from built output", async () => {
    const failures: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`);
    });

    await page.goto(`${base}/`, { waitUntil: "networkidle" });

    // The document is the one rspack is building — it names no content hash,
    // which every published bundle does — while the panes rendering inside it
    // are the built remotes it resolved over the same origin.
    expect(await page.locator("script[src$='/main.js']").count()).toBe(1);
    expect(await page.getByRole("banner").isVisible()).toBe(true);
    expect(
      await page.getByText("Finance researcher & educator").isVisible(),
    ).toBe(true);
    expect(failures).toEqual([]);
  }, 120_000);

  it("resolves the shell's routes across that mix", async () => {
    await page.goto(`${base}/bio`, { waitUntil: "networkidle" });

    // A route the shell owns, rendered by a remote it fetched from the built
    // artifact: both halves of the mix in one page.
    expect(
      await page.getByRole("heading", { level: 1 }).first().innerText(),
    ).toBe("Optimizing Life");
  }, 120_000);

  it("hot-replaces an edit to the app under development into the running page", async () => {
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      Reflect.set(window, "__servedDevSession", "alive");
    });

    const restore = edit(hostEdit);
    try {
      await page.getByTestId("hmr-probe").waitFor({ timeout: 120_000 });
      expect(await page.getByTestId("hmr-probe").innerText()).toBe(
        "hot module replacement probe",
      );
      // The value set before the edit is still there, so the module was
      // replaced in the running page rather than the page being reloaded — and
      // nothing rebuilt the workspace or restarted the server to do it.
      expect(
        await page.evaluate(
          () => Reflect.get(window, "__servedDevSession") === "alive",
        ),
      ).toBe(true);
    } finally {
      restore();
    }
  }, 240_000);
});

describe("a pane served from source", () => {
  let started: StartedRecipe;
  let base: string;

  beforeAll(async () => {
    const port = await availablePort();
    base = `http://127.0.0.1:${port}/nick-derobertis-site`;
    started = startRecipe("awards", port);
    await waitUntilServed(`${base}/remotes/awards/`, started);
  }, 1_800_000);

  afterAll(() => stopRecipe(started));

  it("updates its own page and the composed host from one edit", async () => {
    const pane = await browser.newPage();
    const host = await browser.newPage();
    await pane.goto(`${base}/remotes/awards/`, { waitUntil: "networkidle" });
    expect(await pane.locator(".awards-pane").isVisible()).toBe(true);
    await host.goto(`${base}/`, { waitUntil: "networkidle" });
    expect(await host.getByRole("banner").isVisible()).toBe(true);

    const restore = edit(paneEdit);
    try {
      // The pane's own document is served from source, so the running page
      // takes the edit without a rebuild or a restart.
      await pane.getByTestId("hmr-probe").waitFor({ timeout: 120_000 });
      expect(await pane.getByTestId("hmr-probe").innerText()).toBe(
        "hot module replacement probe",
      );
      // And the composed host — served from built output — resolves that same
      // container over this origin, so the shell's routes render the pane
      // under development rather than the published one.
      await host.reload({ waitUntil: "networkidle" });
      await host.getByTestId("hmr-probe").waitFor({ timeout: 120_000 });
      expect(await host.getByTestId("hmr-probe").innerText()).toBe(
        "hot module replacement probe",
      );
    } finally {
      restore();
      await pane.close();
      await host.close();
    }
  }, 300_000);
});

describe("an app this workspace cannot serve from source", () => {
  it("is refused before anything is built, naming every app that could be", () => {
    const refused = spawnSync("just", ["serve-dev", "not-an-app"], {
      cwd: workspace,
      encoding: "utf8",
    });

    expect(refused.status).toBe(2);
    expect(refused.stderr).toContain(
      "is not an app this workspace serves from source",
    );
    expect(refused.stderr).toContain('"awards"');
    expect(refused.stderr).toContain('"shell"');
    expect(refused.stderr).toContain("rerun just serve-dev <app>");
  }, 60_000);
});
