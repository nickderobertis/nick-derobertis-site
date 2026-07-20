import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/apps/shell", import.meta.url));
const base = "/nick-derobertis-site";
const port = process.env.E2E_PORT ?? "4200";
const portNumber = Number(port);
// llmlint: ignore[changed_behavior_has_e2e] This process-start validation has no browser interface; successful serving is exercised by every Playwright journey.
if (!Number.isInteger(portNumber) || portNumber < 1024 || portNumber > 65_535)
  throw new Error(
    `Invalid E2E_PORT ${JSON.stringify(port)}. Set it to an available numeric port from 1024 to 65535`,
  );
const types = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
};
createServer(async (request, response) => {
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
}).listen(portNumber, "127.0.0.1");
