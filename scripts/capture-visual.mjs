import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";
import { handleE2eDataRequest } from "./e2e-data-provider.mjs";

process.on("uncaughtException", (error) => {
  console.error(
    `capture-visual: ${error instanceof Error ? error.message : String(error)}; rerun the owning just visual-project target after fixing the reported boundary`,
  );
  process.exit(1);
});

const [project, outputArgument] = process.argv.slice(2);
if (!project || !outputArgument || !/^[a-z][a-z0-9-]*$/.test(project))
  throw new Error(
    "usage: capture-visual.mjs <project> <output-root>; example: capture-visual.mjs bio apps/bio/visual/current/x86_64",
  );
const outputRoot = path.resolve(outputArgument);
const allowedOutputRoot = path.resolve("apps", project, "visual");
if (!outputRoot.startsWith(`${allowedOutputRoot}${path.sep}`))
  throw new Error(
    `Output root must be inside ${allowedOutputRoot}; use the project's Nx screenshot target`,
  );
const projectRoot = path.resolve("dist/apps", project);
const visualProjects = JSON.parse(readFileSync("visual-projects.json", "utf8"));
const allowedVisualStates = new Set([
  "all",
  "empty",
  "loading",
  "error",
  "expanded",
  "employment-only",
]);
if (
  typeof visualProjects !== "object" ||
  visualProjects === null ||
  !Object.hasOwn(visualProjects, project) ||
  typeof visualProjects[project].hostPath !== "string" ||
  !/^(?:[a-z][a-z0-9-]*)?$/.test(visualProjects[project].hostPath) ||
  !Array.isArray(visualProjects[project].states) ||
  !visualProjects[project].states.every((state) =>
    allowedVisualStates.has(state),
  )
)
  throw new Error(
    `Project ${project} is not configured in visual-projects.json; add a validated hostPath and states entry before capturing it`,
  );
if (!existsSync(path.join(projectRoot, "index.html")))
  throw new Error(
    `Built remote not found: ${projectRoot}; run pnpm exec nx build ${project} first`,
  );
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);
const routePrefix = `/nick-derobertis-site/remotes/${project}/`;
const pagesPrefix = "/nick-derobertis-site/";
const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  if (
    await handleE2eDataRequest({
      base: pagesPrefix.slice(0, -1),
      loadingMs: 5_000,
      response,
      root: path.resolve("dist/apps/shell"),
      url: requestUrl,
    })
  )
    return;
  const match = requestUrl.pathname.match(
    /^\/nick-derobertis-site\/remotes\/([a-z][a-z0-9-]*)\/(.*)$/,
  );
  if (match && !existsSync(path.join("apps", match[1], "project.json"))) {
    response.writeHead(400).end("Unknown visual project");
    return;
  }
  const servedRoot = match
    ? path.resolve("dist/apps", match[1])
    : existsSync("dist/apps/shell/index.html")
      ? path.resolve("dist/apps/shell")
      : projectRoot;
  const shellRelative = requestUrl.pathname.startsWith(pagesPrefix)
    ? requestUrl.pathname.slice(pagesPrefix.length)
    : requestUrl.pathname.slice(1);
  let candidate = path.resolve(
    servedRoot,
    match ? match[2] || "index.html" : shellRelative || "index.html",
  );
  if (!match && (!existsSync(candidate) || statSync(candidate).isDirectory())) {
    candidate = path.join(servedRoot, shellRelative, "index.html");
  }
  if (
    !candidate.startsWith(`${servedRoot}${path.sep}`) ||
    !existsSync(candidate) ||
    !statSync(candidate).isFile()
  ) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.setHeader(
    "content-type",
    contentTypes.get(path.extname(candidate)) ?? "application/octet-stream",
  );
  createReadStream(candidate).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string")
  throw new Error(
    `Could not start visual capture server; check local loopback availability and rerun just visual-project ${project}`,
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
const viewports = [
  ["desktop", 1110, 900],
  ["tablet", 768, 1024],
  ["mobile", 375, 812],
];
const hostPath = visualProjects[project].hostPath;
const projectStates = visualProjects[project].states;

function queryFor(state) {
  if (state === "happy") return "";
  if (project === "awards")
    return state === "all" ? "?awards-view=all" : `?awards-scenario=${state}`;
  if (project === "research") return `?research-scenario=${state}`;
  if (project === "bio") return `?bio-view=${state}`;
  if (project === "courses") return `?courses-view=${state}`;
  if (project === "software") return `?software-view=${state}`;
  if (project.startsWith("home")) return `?state=${state}`;
  if (project === "skills" && state !== "expanded")
    return `?skills-state=${state}`;
  if (project === "timeline" && state !== "employment-only")
    return `?timeline-state=${state}`;
  return "";
}

async function prepareCaptureTarget(page, state) {
  const homeTargets = new Map([
    ["home-carousel", ["region", "Featured work"]],
    ["home-cards", ["region", "Areas of work"]],
    ["home-story", ["heading", "Who am I?"]],
    ["home-contact", ["heading", "Let’s build something useful."]],
  ]);
  if (["empty", "loading", "error"].includes(state)) {
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;caret-color:transparent!important;transition:none!important}",
    });
    const loadingText = new Map([
      ["awards", "Loading awards…"],
      ["bio", "Loading biography"],
      ["courses", "Loading courses…"],
      ["home", "Loading featured stories…"],
      ["home-cards", "Loading areas of work…"],
      ["home-carousel", "Loading featured stories…"],
      ["home-contact", "Loading contact options…"],
      ["home-story", "Loading Nick’s story…"],
      ["skills", "Loading skills…"],
      ["software", "Loading software projects…"],
      ["timeline", "Loading timeline…"],
    ]);
    const findIndicator = () => {
      if (project === "research") return page.locator(".research-state");
      let locator = page.getByRole(
        state === "error" && !project.startsWith("home") ? "alert" : "status",
      );
      if (project !== "home")
        locator = locator.filter({ hasNotText: "Loading HOME page…" });
      const expectedLoadingText = loadingText.get(project);
      return state === "loading" && expectedLoadingText
        ? locator.filter({ hasText: expectedLoadingText })
        : locator;
    };
    const indicator = findIndicator();
    try {
      await indicator.first().waitFor({ state: "visible" });
    } catch (error) {
      throw new Error(
        `${project} ${state} indicator did not render; verify the e2e data provider and rerun the screenshot target`,
        { cause: error },
      );
    }
    return indicator.first();
  }
  if (project === "awards")
    return page.getByRole("region", {
      name: state === "all" ? "Awards & honors" : "Selected awards",
    });
  if (project === "research") return page.locator(".research-page");
  if (project === "skills") {
    if (state === "expanded")
      await page
        .getByRole("button", { name: "Explore Programming category" })
        .click();
    return page.getByRole("region", { name: "Skilled in…" });
  }
  if (project === "timeline") {
    if (state === "employment-only")
      await page.getByRole("checkbox", { name: "Education" }).uncheck();
    return page.getByRole("region", { name: "Educated and Experienced" });
  }
  if (homeTargets.has(project)) {
    const [role, name] = homeTargets.get(project);
    return page.getByRole(role, { name });
  }
  if (project === "home") return page.locator("body");
  return page.locator("body");
}

const shots = [];
try {
  const scenarios = [{ render: "standalone", state: "happy", viewports }];
  scenarios.push({ render: "host-composed", state: "happy", viewports });
  for (const state of projectStates) {
    for (const render of ["standalone", "host-composed"])
      scenarios.push({ render, state, viewports: [viewports[0]] });
  }
  for (const scenario of scenarios) {
    for (const [viewport, width, height] of scenario.viewports) {
      const context = await browser.newContext({
        deviceScaleFactor: 2,
        reducedMotion: "reduce",
        viewport: { width, height },
      });
      const page = await context.newPage();
      const browserErrors = [];
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          scenario.state !== "error" &&
          !message.text().startsWith("Failed to load resource:")
        )
          browserErrors.push(`browser console: ${message.text()}`);
      });
      page.on("pageerror", (error) => {
        if (
          scenario.state !== "error" &&
          !error.message.startsWith("Loading chunk ") &&
          !error.message.includes("[ Federation Runtime ]")
        )
          browserErrors.push(`page error: ${error.message}`);
      });
      page.on("response", (response) => {
        if (
          response.status() >= 400 &&
          scenario.state !== "error" &&
          !response.url().includes("/cv-data/domains/")
        )
          browserErrors.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      await page.clock.install({ time: new Date("2026-07-20T12:00:00Z") });
      if (scenario.state === "loading")
        await page.addInitScript(() => {
          const nativeSetTimeout = window.setTimeout.bind(window);
          window.setTimeout = (handler, timeout = 0, ...args) =>
            nativeSetTimeout(
              handler,
              timeout >= 400 ? 2_147_483_647 : timeout,
              ...args,
            );
        });
      const relative =
        scenario.render === "standalone"
          ? routePrefix
          : `${pagesPrefix}${hostPath}`;
      if (scenario.render === "host-composed" && scenario.state !== "happy") {
        await page.goto(`http://127.0.0.1:${address.port}${routePrefix}`, {
          waitUntil: "networkidle",
        });
      }
      await page.goto(
        `http://127.0.0.1:${address.port}${relative}${queryFor(scenario.state)}`,
        {
          waitUntil:
            scenario.state === "loading" ? "domcontentloaded" : "networkidle",
        },
      );
      if (project === "home") {
        await page
          .getByText("Loading HOME page…")
          .waitFor({ state: "hidden", timeout: 30_000 });
      }
      const target = await prepareCaptureTarget(page, scenario.state);
      await target.waitFor({ state: "visible" });
      if (!["empty", "loading", "error"].includes(scenario.state))
        await page.clock.pauseAt(
          new Date((await page.evaluate(() => Date.now())) + 1_000),
        );
      const image = `${scenario.render}/${scenario.state}/${viewport}.png`;
      mkdirSync(path.dirname(path.join(outputRoot, image)), {
        recursive: true,
      });
      await target.screenshot({
        animations: "disabled",
        path: path.join(outputRoot, image),
      });
      if (browserErrors.length > 0)
        throw new Error(
          `Visual capture reported ${browserErrors.join("; ")}; rerun just visual-project ${project} and inspect this scenario`,
        );
      const hash = createHash("sha256")
        .update(readFileSync(path.join(outputRoot, image)))
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
