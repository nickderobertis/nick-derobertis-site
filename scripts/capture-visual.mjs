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

const [project, outputRoot] = process.argv.slice(2);
if (!project || !outputRoot || !/^[a-z][a-z0-9-]*$/.test(project))
  throw new Error("usage: capture-visual.mjs <project> <output-root>");
const projectRoot = path.resolve("dist/apps", project);
if (!existsSync(path.join(projectRoot, "index.html")))
  throw new Error(`Built remote not found: ${projectRoot}`);
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
  const dataDomain = ["research", "awards"].find(
    (domain) =>
      requestUrl.pathname === `${pagesPrefix}cv-data/domains/${domain}.json`,
  );
  if (dataDomain) {
    const scenario = requestUrl.searchParams.get("scenario");
    if (scenario === "loading")
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    if (scenario === "error") {
      response
        .writeHead(503, { "content-type": "application/json" })
        .end(JSON.stringify({ error: `${dataDomain} unavailable` }));
      return;
    }
    if (scenario === "empty") {
      response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify(dataDomain === "research" ? { projects: [] } : []));
      return;
    }
  }
  const match = requestUrl.pathname.match(
    /^\/nick-derobertis-site\/remotes\/([a-z][a-z0-9-]*)\/(.*)$/,
  );
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
  throw new Error("Could not start visual capture server");
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
const composedPaths = new Map([
  ["awards", ""],
  ["research", "research"],
  ["skills", ""],
  ["timeline", ""],
]);
const stateQueries = new Map([
  ["awards", ["all", "empty", "loading", "error"]],
  ["research", ["empty", "loading", "error"]],
  ["skills", ["empty", "loading", "error", "expanded"]],
  ["timeline", ["empty", "loading", "error", "employment-only"]],
]);

function queryFor(state) {
  if (state === "happy") return "";
  if (project === "awards")
    return state === "all" ? "?awards-view=all" : `?awards-scenario=${state}`;
  if (project === "research") return `?research-scenario=${state}`;
  if (project === "skills" && state !== "expanded")
    return `?skills-state=${state}`;
  if (project === "timeline" && state !== "employment-only")
    return `?timeline-state=${state}`;
  return "";
}

async function captureTarget(page, state) {
  if (["empty", "loading", "error"].includes(state)) {
    if (project === "research") return page.locator(".research-state");
    if (state === "loading")
      return page.getByText(`Loading ${project}…`, { exact: true });
    return page.getByRole(state === "error" ? "alert" : "status");
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
  return page.locator("body");
}

const shots = [];
try {
  const scenarios = [{ render: "standalone", state: "happy", viewports }];
  if (composedPaths.has(project))
    scenarios.push({ render: "host-composed", state: "happy", viewports });
  for (const state of stateQueries.get(project) ?? []) {
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
      page.on("console", (message) => {
        if (message.type() === "error") console.error(message.text());
      });
      page.on("pageerror", (error) => console.error(error.message));
      page.on("response", (response) => {
        if (response.status() >= 400)
          console.error(`${response.status()} ${response.url()}`);
      });
      await page.clock.install({ time: new Date("2026-07-20T12:00:00Z") });
      const relative =
        scenario.render === "standalone"
          ? routePrefix
          : `${pagesPrefix}${composedPaths.get(project) ?? ""}`;
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
      const target = await captureTarget(page, scenario.state);
      await target.waitFor({ state: "visible" });
      const image = `${scenario.render}/${scenario.state}/${viewport}.png`;
      mkdirSync(path.dirname(path.join(outputRoot, image)), {
        recursive: true,
      });
      await target.screenshot({
        animations: "disabled",
        path: path.join(outputRoot, image),
      });
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
