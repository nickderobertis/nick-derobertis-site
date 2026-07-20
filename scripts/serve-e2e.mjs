import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/apps/shell", import.meta.url));
const base = "/nick-derobertis-site";
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
}).listen(4200, "127.0.0.1");
