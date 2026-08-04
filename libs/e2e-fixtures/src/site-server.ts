import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { basename, extname, join, normalize, sep } from "node:path";
import { handleE2eDataRequest } from "./e2e-data.ts";

/** What a request resolved to: bytes under a document root, or a refusal. */
export type SiteRouting =
  | { root: string; relative: string }
  | { status: number; body: string };

/** What to answer with when the resolved path names no readable file. */
export type SiteNotFound = { file: string } | { status: number; body: string };

export interface SiteServerOptions {
  /** The document root served beneath the Pages base path. */
  root: string;
  /** The Pages base path, such as `/nick-derobertis-site`. */
  base: string;
  /**
   * How long a remote's lazily loaded JavaScript is held back, which is what
   * makes a skeleton observable in a browser journey. Zero serves it at once.
   */
  lazyAssetLatencyMs?: number;
  /** How long a `?scenario=loading` CV-data request is held. */
  dataLoadingMs?: number;
  /** The root the CV-data fixtures are read from; defaults to `root`. */
  dataRoot?: string;
  /** Extension-to-Content-Type map for the files this server streams. */
  contentTypes?: Readonly<Record<string, string>>;
  /** How a request for a path the root does not contain is answered. */
  notFound?: SiteNotFound;
  /**
   * Sends a request to a document root other than the default one — this is
   * how a capture host serves each remote from its own build output. Returning
   * undefined keeps the default root and base-relative path.
   */
  route?: (url: URL) => SiteRouting | undefined;
}

const defaultContentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
};

/**
 * A remote's eagerly loaded bytes: its entry, its container, and the shared
 * chunks a host needs before it can render anything at all. Delaying these
 * would postpone the skeleton the lazy delay exists to make observable.
 */
function isEagerRemoteAsset(assetName: string) {
  return (
    assetName.startsWith("main.") ||
    assetName === "remoteEntry.js" ||
    assetName.startsWith("common.") ||
    assetName.startsWith("__federation_expose_Skeleton.")
  );
}

function contains(file: string, root: string) {
  return file === root || file.startsWith(`${root}${sep}`);
}

/**
 * Serves a built artifact the way GitHub Pages serves it — every route beneath
 * one base path — together with the CV-data scenarios browser journeys steer.
 * Callers own their artifact layout through `route`, `notFound`, and the
 * latency options; everything else about serving the bytes is shared.
 */
export function createSiteServer({
  root,
  base,
  lazyAssetLatencyMs = 0,
  dataLoadingMs = 750,
  dataRoot = root,
  contentTypes = defaultContentTypes,
  notFound = { status: 404, body: "Not found" },
  route,
}: SiteServerOptions): Server {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (
      await handleE2eDataRequest({
        base,
        loadingMs: dataLoadingMs,
        response,
        root: dataRoot,
        url,
      })
    )
      return;
    const routing = route?.(url) ?? {
      root,
      relative: url.pathname.startsWith(base)
        ? url.pathname.slice(base.length)
        : url.pathname,
    };
    if ("status" in routing) {
      response.writeHead(routing.status).end(routing.body);
      return;
    }
    // Pages resolves a `..` segment against the base path, so normalizing here
    // is what keeps `/base/../index.html` the site's own document; anything
    // that still climbs out of the root after that is answered as missing.
    let file = join(routing.root, normalize(routing.relative));
    try {
      if (!contains(file, routing.root)) throw new Error("outside the root");
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      await stat(file);
    } catch {
      if (!("file" in notFound)) {
        response.writeHead(notFound.status).end(notFound.body);
        return;
      }
      file = join(routing.root, notFound.file);
    }
    response.setHeader(
      "Content-Type",
      contentTypes[extname(file)] ?? "application/octet-stream",
    );
    if (
      lazyAssetLatencyMs > 0 &&
      url.pathname.includes("/remotes/") &&
      extname(file) === ".js" &&
      !isEagerRemoteAsset(basename(file))
    )
      await new Promise((resolve) => setTimeout(resolve, lazyAssetLatencyMs));
    createReadStream(file).pipe(response);
  });
}

/**
 * Closes a site server once, on any of the given signals, so a supervising
 * runner that sends SIGTERM gets the listening port back instead of a process
 * that outlives it. `onCloseError` reports a close the caller must act on.
 */
export function closeOnSignals(
  server: Server,
  signals: readonly NodeJS.Signals[],
  onCloseError: (error: Error) => void,
): void {
  let shuttingDown = false;
  const shutDown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close((error) => {
      if (error) onCloseError(error);
    });
    server.closeAllConnections();
  };
  for (const signal of signals) process.on(signal, shutDown);
}
