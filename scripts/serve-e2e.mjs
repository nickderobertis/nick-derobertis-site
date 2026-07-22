import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import siteConfig from "../libs/data-access-core/src/site.config.json" with {
  type: "json",
};
import { handleE2eDataRequest } from "./e2e-data-provider.mjs";

function validateSiteConfig(value) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.pagesBase !== "string" ||
    !/^\/[a-z0-9-]+$/.test(value.pagesBase)
  )
    throw new Error(
      `site.config.json pagesBase must match /[a-z0-9-]+; received ${JSON.stringify(value?.pagesBase)}. Fix it and run just test-e2e again.`,
    );
  return value;
}

const root = fileURLToPath(new URL("../dist/apps/shell", import.meta.url));
const base = validateSiteConfig(siteConfig).pagesBase;
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
  if (
    await handleE2eDataRequest({
      base,
      loadingMs: 750,
      response,
      root,
      url,
    })
  )
    return;
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
server.listen(port, "127.0.0.1");
// llmlint: ignore-end[changed_behavior_has_e2e]

let shuttingDown = false;
function shutDown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close((error) => {
    if (error) {
      console.error(
        `Could not stop the e2e server cleanly: ${error.message}. Ensure no requests are stuck, then rerun just test-e2e.`,
      );
      process.exitCode = 1;
    }
  });
  server.closeAllConnections();
}

process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);
