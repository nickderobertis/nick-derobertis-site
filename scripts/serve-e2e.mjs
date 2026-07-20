import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/apps/shell", import.meta.url));
const base = process.env.SITE_E2E_BASE_PATH;
if (typeof base !== "string" || !/^\/[a-z0-9-]+$/.test(base))
  throw new Error(
    "SITE_E2E_BASE_PATH must start with / and contain only lowercase letters, digits, and hyphens; run the server through the Playwright config or set SITE_E2E_BASE_PATH and retry",
  );
const port = Number.parseInt(process.env.SITE_E2E_PORT ?? "4200", 10);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535)
  throw new Error(
    "SITE_E2E_PORT must be an integer between 1024 and 65535; set SITE_E2E_PORT to an available port in that range and retry",
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
}).listen(port, "127.0.0.1");
