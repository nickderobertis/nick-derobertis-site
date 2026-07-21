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
const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  const match = requestUrl.pathname.match(
    /^\/nick-derobertis-site\/remotes\/([a-z][a-z0-9-]*)\/(.*)$/,
  );
  const servedRoot = match ? path.resolve("dist/apps", match[1]) : projectRoot;
  const candidate = path.resolve(servedRoot, match?.[2] || "index.html");
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
const shots = [];
try {
  for (const [viewport, width, height] of viewports) {
    const context = await browser.newContext({
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
      viewport: { width, height },
    });
    const page = await context.newPage();
    await page.clock.install({ time: new Date("2026-07-20T12:00:00Z") });
    await page.goto(`http://127.0.0.1:${address.port}${routePrefix}`, {
      waitUntil: "networkidle",
    });
    if (project === "home") {
      await page
        .getByText("Loading HOME page…")
        .waitFor({ state: "hidden", timeout: 30_000 });
    }
    mkdirSync(outputRoot, { recursive: true });
    const image = `${viewport}.png`;
    await page.locator("body").screenshot({
      animations: "disabled",
      path: path.join(outputRoot, image),
    });
    const hash = createHash("sha256")
      .update(readFileSync(path.join(outputRoot, image)))
      .digest("hex");
    shots.push({ name: project, toggles: { viewport }, hash, image });
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
writeFileSync(
  path.join(outputRoot, "captures.json"),
  `${JSON.stringify({ schema: 1, shots }, null, 2)}\n`,
);
