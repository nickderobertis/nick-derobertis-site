import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Locator, Page } from "@playwright/test";
import { chromium } from "@playwright/test";
// eslint-disable-next-line @nx/enforce-module-boundaries -- Node executes the TypeScript capture entry directly, so this shared runtime fixture cannot rely on Vite's tsconfig alias resolution.
import { validatePagesBase } from "../../artifact-contracts/src/index.ts";
// eslint-disable-next-line @nx/enforce-module-boundaries -- Node executes the TypeScript capture entry directly, so this shared runtime fixture cannot rely on Vite's tsconfig alias resolution.
import { createSiteServer } from "../../e2e-fixtures/src/index.ts";

// The Pages base has exactly one source, libs/data-access-core/src/site.config.json,
// and a capture that restated it would serve every remote from a prefix the
// deployed site does not use. It is read as the serialized build input it is,
// resolved from this module so the capture's cwd cannot change the answer, and
// checked with the same contract the prerender and artifact gates apply.
const siteConfigPath = fileURLToPath(
  new URL("../../data-access-core/src/site.config.json", import.meta.url),
);

function readPagesBase(): string {
  const siteConfig: unknown = JSON.parse(readFileSync(siteConfigPath, "utf8"));
  return validatePagesBase(
    typeof siteConfig === "object" &&
      siteConfig !== null &&
      "pagesBase" in siteConfig
      ? siteConfig.pagesBase
      : undefined,
  );
}

export type VisualViewport = "desktop" | "tablet" | "mobile";
export type VisualScenario = {
  state: string;
  render: "standalone" | "host-composed";
  viewports: ReadonlyArray<VisualViewport>;
  query?: string;
  stallTimers?: boolean;
  freezeAnimations?: boolean;
  prepare?: (page: Page) => Promise<void>;
  target: (page: Page) => Locator;
  allowPageErrors?: boolean;
};
export type VisualSuite = {
  project: string;
  hostPath: string;
  scenarios: VisualScenario[];
};

process.on("uncaughtException", (error) => {
  console.error(
    `capture-visual: ${error instanceof Error ? error.message : String(error)}; rerun the owning nx screenshot target after fixing the reported boundary`,
  );
  process.exit(1);
});

export async function captureVisualSuite(
  suite: VisualSuite,
  outputArgument: string,
): Promise<void> {
  const { project } = suite;
  if (!outputArgument || !/^[a-z][a-z0-9-]*$/.test(project))
    throw new Error(
      "captureVisualSuite requires a valid suite and output root",
    );
  const outputRoot = path.resolve(outputArgument);
  // The reusable visual-docs workflow hands the capture a per-project/arch
  // SHOTS_OUT beneath shots/ (shots/current/<project>/<arch> and its verify twin).
  // Confine writes to this project's own capture roots so a mistyped SHOTS_OUT can
  // never clobber another project's tree or escape the workspace.
  const allowedOutputRoots = [
    path.resolve("shots", "current", project),
    path.resolve("shots", "verify", project),
  ];
  if (
    !allowedOutputRoots.some(
      (root) =>
        outputRoot === root || outputRoot.startsWith(`${root}${path.sep}`),
    )
  )
    throw new Error(
      `Output root must be inside shots/current/${project} or shots/verify/${project}; the visual-docs workflow sets SHOTS_OUT for you`,
    );
  const projectRoot = path.resolve("dist/apps", project);
  if (!/^(?:[a-z][a-z0-9-]*)?$/.test(suite.hostPath))
    throw new Error(`Invalid hostPath for ${project}`);
  if (!existsSync(path.join(projectRoot, "index.html")))
    throw new Error(
      `Built remote not found: ${projectRoot}; run pnpm exec nx build ${project} first`,
    );
  const pagesBase = readPagesBase();
  const routePrefix = `${pagesBase}/remotes/${project}/`;
  const shellRoot = path.resolve("dist/apps/shell");
  const remoteRequestPattern = new RegExp(
    `^${pagesBase}/remotes/([a-z][a-z0-9-]*)/(.*)$`,
  );
  const server = createSiteServer({
    base: pagesBase,
    contentTypes: {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
    },
    // A `loading` capture must still show its skeleton when the shot is taken, so
    // the steered domain stays pending well past the capture itself.
    dataLoadingMs: 5_000,
    dataRoot: shellRoot,
    // The composed shell is served whenever it has been built; otherwise this
    // project's own standalone output is all a capture can load.
    root: existsSync(path.join(shellRoot, "index.html"))
      ? shellRoot
      : projectRoot,
    // Each remote is served from the bytes its own build published, so a
    // host-composed capture loads every pane exactly as the deployed site does.
    route: (url) => {
      const match = remoteRequestPattern.exec(url.pathname);
      if (!match) return undefined;
      const remote = match[1];
      if (!remote || !existsSync(path.join("apps", remote, "project.json")))
        return { status: 400, body: "Unknown visual project" };
      return {
        root: path.resolve("dist/apps", remote),
        relative: match[2] || "index.html",
      };
    },
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error(
      `Could not start visual capture server; check local loopback availability and rerun the ${project} screenshot target`,
    );
  const browser = await chromium.launch({
    args: [
      "--disable-skia-runtime-opts",
      "--headless=new",
      "--disable-gpu",
      "--disable-gpu-rasterization",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--force-color-profile=srgb",
      "--font-render-hinting=none",
      "--disable-lcd-text",
      "--hide-scrollbars",
      "--disable-dev-shm-usage",
    ],
  });
  const viewports: Record<VisualViewport, { width: number; height: number }> = {
    desktop: { width: 1110, height: 900 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 812 },
  };
  const shots = [];
  try {
    for (const scenario of suite.scenarios) {
      for (const viewport of scenario.viewports) {
        const viewportConfig = viewports[viewport];
        const context = await browser.newContext({
          deviceScaleFactor: 2,
          reducedMotion: "reduce",
          viewport: viewportConfig,
        });
        const page = await context.newPage();
        // Install the canonical clock before any application code runs. Installing
        // it after navigation can replace React's timing primitives while a busy
        // worker is still hydrating, producing a false structural mismatch.
        await page.clock.install({ time: new Date("2026-07-20T12:00:00Z") });
        const browserErrors: string[] = [];
        page.on("console", (message) => {
          if (
            message.type() === "error" &&
            !scenario.allowPageErrors &&
            !message.text().startsWith("Failed to load resource:")
          )
            browserErrors.push(`browser console: ${message.text()}`);
        });
        page.on("pageerror", (error) => {
          if (
            !scenario.allowPageErrors &&
            !error.message.startsWith("Loading chunk ") &&
            !error.message.includes("[ Federation Runtime ]")
          )
            browserErrors.push(`page error: ${error.message}`);
        });
        page.on("response", (response) => {
          if (
            response.status() >= 400 &&
            !scenario.allowPageErrors &&
            !response.url().includes("/cv-data/domains/")
          )
            browserErrors.push(`HTTP ${response.status()}: ${response.url()}`);
        });
        if (scenario.stallTimers)
          await page.addInitScript(() => {
            const nativeSetTimeout = window.setTimeout.bind(window);
            // DOM and Node timer declarations overlap in this test runtime;
            // preserve the browser overloads after wrapping the native timer.
            window.setTimeout = ((
              handler: TimerHandler,
              timeout = 0,
              ...args: unknown[]
            ) =>
              nativeSetTimeout(
                handler,
                timeout >= 400 ? 2_147_483_647 : timeout,
                ...args,
              )) as typeof window.setTimeout;
          });
        const relative =
          scenario.render === "standalone"
            ? routePrefix
            : `${pagesBase}/${suite.hostPath}`;
        await page.goto(
          `http://127.0.0.1:${address.port}${relative}${scenario.query ?? ""}`,
          {
            waitUntil: scenario.stallTimers
              ? "domcontentloaded"
              : "networkidle",
          },
        );
        if (scenario.prepare) await scenario.prepare(page);
        if (scenario.freezeAnimations)
          await page.addStyleTag({
            content:
              "*,*::before,*::after{animation:none!important;caret-color:transparent!important;transition:none!important}",
          });
        const image = `${scenario.render}/${scenario.state}/${viewport}.png`;
        mkdirSync(path.dirname(path.join(outputRoot, image)), {
          recursive: true,
        });
        const capturePath = path.join(outputRoot, image);
        const initialTarget = await scenario.target(page);
        await initialTarget.waitFor({ state: "visible" });
        // Freeze only after the scenario has rendered. Reading the emulated time
        // immediately before pausing avoids travel-to-the-past races without
        // fast-forwarding long enough to advance carousel application state.
        let clockPaused = false;
        for (let attempt = 0; attempt < 5 && !clockPaused; attempt += 1) {
          const pauseTime = await page.evaluate(() => Date.now() + 1_000);
          try {
            await page.clock.pauseAt(pauseTime);
            clockPaused = true;
          } catch (error) {
            if (
              attempt === 4 ||
              !(error instanceof Error) ||
              !error.message.includes("Cannot fast-forward to the past")
            )
              throw new Error(
                `Could not freeze the browser clock before capturing ${image}: ${error instanceof Error ? error.message : String(error)}. Verify the page reaches a stable state, then rerun just check.`,
                { cause: error },
              );
          }
        }
        let captured = false;
        for (let attempt = 0; attempt < 2 && !captured; attempt += 1) {
          const target =
            attempt === 0 ? initialTarget : await scenario.target(page);
          await target.waitFor({ state: "visible" });
          try {
            await target.screenshot({
              animations: "disabled",
              path: capturePath,
            });
            captured = true;
          } catch (error) {
            if (
              attempt > 0 ||
              !(error instanceof Error) ||
              !error.message.includes("Element is not attached to the DOM")
            )
              throw new Error(
                `Could not capture ${image} after retrying its render target: ${error instanceof Error ? error.message : String(error)}. Verify the scenario remains visible, then rerun just check.`,
                { cause: error },
              );
          }
        }
        if (browserErrors.length > 0)
          throw new Error(
            `Visual capture reported ${browserErrors.join("; ")} in ${scenario.render}/${scenario.state}/${viewport}; rerun the ${project} screenshot target and inspect this scenario`,
          );
        const hash = createHash("sha256")
          .update(readFileSync(capturePath))
          .digest("hex");
        shots.push({
          name: project,
          toggles: {
            render: scenario.render,
            state: scenario.state,
            viewport,
          },
          hash,
          image,
        });
        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  writeFileSync(
    path.join(outputRoot, "captures.json"),
    `${JSON.stringify({ schema: 1, shots }, null, 2)}\n`,
  );
}
