import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import siteConfig from "../libs/data-access/src/site.config.json" with {
  type: "json",
};

const root = fileURLToPath(new URL("../dist/apps/shell", import.meta.url));
if (
  !siteConfig ||
  typeof siteConfig.pagesBase !== "string" ||
  !/^\/[a-z0-9-]+$/.test(siteConfig.pagesBase)
)
  throw new Error(
    `site.config.json pagesBase must match /[a-z0-9-]+; received ${JSON.stringify(siteConfig?.pagesBase)}. Fix it and run just test-e2e again.`,
  );
const base = siteConfig.pagesBase;
// llmlint: ignore-block[changed_behavior_has_e2e] Server startup validation is exercised through the real serve-e2e subprocess in home.spec.ts; it occurs before a browser interface exists.
const portValue = process.env.PORT ?? "4200";
const port = Number(portValue);
if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error(
    `PORT must be an integer from 1 to 65535; received ${JSON.stringify(portValue)}. Set a valid PORT and run just test-e2e again.`,
  );
// llmlint: ignore-end[changed_behavior_has_e2e]
const types = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const dataDomain = ["research", "awards"].find(
    (domain) => url.pathname === `${base}/cv-data/domains/${domain}.json`,
  );
  if (dataDomain) {
    const scenario = url.searchParams.get("scenario");
    if (scenario === "loading")
      await new Promise((resolve) => setTimeout(resolve, 750));
    if (scenario === "error") {
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: `${dataDomain} unavailable` }));
      return;
    }
    if (scenario === "empty") {
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify(dataDomain === "research" ? { projects: [] } : []),
      );
      return;
    }
    const domainPath = join(root, `cv-data/domains/${dataDomain}.json`);
    let domainData;
    try {
      domainData = await readFile(domainPath);
    } catch (error) {
      console.error(
        `Unable to read ${domainPath}. Run \`just build\` before starting the e2e server.`,
        error,
      );
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({ error: `${dataDomain} fixture unavailable` }),
      );
      return;
    }
    response.setHeader("Content-Type", "application/json");
    response.end(domainData);
    return;
  }
  const relative = normalize(
    url.pathname.startsWith(base)
      ? url.pathname.slice(base.length)
      : url.pathname,
  ).replace(/^\.\.(\/|\\)/, "");
  let file = join(root, relative);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    await stat(file);
  } catch {
    file = join(root, "404.html");
  }
  response.setHeader(
    "Content-Type",
    types[extname(file)] ?? "application/octet-stream",
  );
  createReadStream(file).pipe(response);
});
// llmlint: ignore-block[changed_behavior_has_e2e] Listen failures are exercised through the real serve-e2e subprocess with an occupied port in home.spec.ts; no browser can connect in this state.
server.on("error", (error) => {
  console.error(
    `Could not start the e2e server on port ${port}: ${error.message}. Choose an available PORT and run just test-e2e again.`,
  );
  process.exitCode = 1;
});
// llmlint: ignore-end[changed_behavior_has_e2e]
server.listen(port, "127.0.0.1");
