import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
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
  if (url.pathname === `${base}/cv-data/domains/research.json`) {
    const scenario = url.searchParams.get("scenario");
    if (scenario === "loading")
      await new Promise((resolve) => setTimeout(resolve, 750));
    if (scenario === "error") {
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "research unavailable" }));
      return;
    }
    if (scenario === "empty") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ projects: [] }));
      return;
    }
    const research = await readFile(
      join(root, "cv-data/domains/research.json"),
    );
    response.setHeader("Content-Type", "application/json");
    response.end(research);
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
}).listen(4534, "127.0.0.1");
