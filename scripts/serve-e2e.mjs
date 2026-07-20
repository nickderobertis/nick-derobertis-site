import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
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
const portValue = process.env.PORT ?? "4200";
const port = Number(portValue);
if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error(
    `PORT must be an integer from 1 to 65535; received ${JSON.stringify(portValue)}. Set a valid PORT and run just test-e2e again.`,
  );
const types = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
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
server.on("error", (error) => {
  console.error(
    `Could not start the e2e server on port ${port}: ${error.message}. Choose an available PORT and run just test-e2e again.`,
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1");
