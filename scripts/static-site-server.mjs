import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const base = "/nick-derobertis-site";
const types = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
};

export function createStaticSiteServer(root) {
  const resolvedRoot = resolve(root);
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const relative = normalize(
      url.pathname.startsWith(base)
        ? url.pathname.slice(base.length)
        : url.pathname,
    ).replace(/^[/\\]+/, "");
    let file = resolve(resolvedRoot, relative);
    if (file !== resolvedRoot && !file.startsWith(`${resolvedRoot}${sep}`)) {
      response.statusCode = 400;
      response.end("Invalid path");
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      await stat(file);
    } catch {
      response.statusCode = 404;
      file = join(resolvedRoot, "404.html");
    }
    response.setHeader(
      "Content-Type",
      types[extname(file)] ?? "application/octet-stream",
    );
    createReadStream(file).pipe(response);
  });
}
