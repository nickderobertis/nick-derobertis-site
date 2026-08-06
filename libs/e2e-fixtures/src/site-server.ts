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
  /**
   * How long the page code of the remote a journey named through
   * `?hold-remote-code=` is held back. This is the window a journey that has to
   * watch a federation boundary suspend gets, so it is far longer than the
   * latency every other remote's page code is served under.
   */
  holdRemoteCodeMs?: number;
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
 * The query a journey navigates with to name the one remote whose lazily loaded
 * page code this server holds back: `bio?hold-remote-code=awards` asks for a
 * long enough window to watch that remote's federation boundary suspend. The
 * hold lasts until the next document is requested, so it cannot outlive the
 * journey that asked for it, and a client-side navigation keeps it.
 */
export const holdRemoteCodeQuery = "hold-remote-code";

/**
 * The header a held response carries, naming the remote it was held for. A
 * journey reads it off the responses it already watches, so it can prove the
 * hold caught real page code instead of quietly matching nothing.
 */
export const heldRemoteCodeHeader = "x-e2e-held-remote-code";

const remoteNamePattern = /^[a-z][a-z0-9-]*$/;

/**
 * Whether a remote asset is one this server always serves at once: its entry,
 * its container, and the shared chunks a host needs before it can render
 * anything at all. Everything else a remote publishes is its lazily loaded page
 * code, which is what the latency options below hold back so a skeleton is
 * observable; delaying the eager set would postpone that skeleton instead.
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
 * Whether this request is for one of the site's documents rather than one of
 * the assets a document pulls in. Only a document carries the query a visitor
 * — or a journey — navigated with, so this is where a page-code hold is armed.
 */
function isDocumentRequest(url: URL) {
  const extension = extname(url.pathname);
  return extension === "" || extension === ".html";
}

/**
 * Serves a built artifact the way GitHub Pages serves it — every route beneath
 * one base path — together with the CV-data scenarios browser journeys steer
 * and the page-code hold they arm through `?hold-remote-code=`. Those two are
 * the only way a journey opens a pending boundary long enough to watch: the
 * server answers the site's real requests slowly, so nothing in the browser has
 * to stand in for the network. Callers own their artifact layout through
 * `route`, `notFound`, and the latency options; everything else about serving
 * the bytes is shared.
 */
export function createSiteServer({
  root,
  base,
  lazyAssetLatencyMs = 0,
  holdRemoteCodeMs = 3_000,
  dataLoadingMs = 750,
  dataRoot = root,
  contentTypes = defaultContentTypes,
  notFound = { status: 404, body: "Not found" },
  route,
}: SiteServerOptions): Server {
  // The remote whose page code is held back for the journey now underway. Each
  // document request re-reads it, so a hold ends with the navigation that armed
  // it and nothing leaks into the next journey.
  let heldRemote: string | undefined;
  return createServer(async (request, response) => {
    /* v8 ignore next -- Node always sets a request target on an HTTP request; the fallback only keeps the URL construction total. */
    const url = new URL(request.url ?? "/", "http://localhost");
    if (isDocumentRequest(url)) {
      const named = url.searchParams.get(holdRemoteCodeQuery);
      if (named !== null && !remoteNamePattern.test(named)) {
        response.writeHead(400).end("Unsupported e2e remote-code hold");
        return;
      }
      heldRemote = named ?? undefined;
    }
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
    const lazyRemoteAsset =
      url.pathname.includes("/remotes/") &&
      extname(file) === ".js" &&
      !isEagerRemoteAsset(basename(file));
    const heldFor =
      lazyRemoteAsset &&
      heldRemote !== undefined &&
      url.pathname.includes(`/remotes/${heldRemote}/`)
        ? heldRemote
        : undefined;
    if (heldFor !== undefined)
      response.setHeader(heldRemoteCodeHeader, heldFor);
    const latencyMs =
      heldFor !== undefined
        ? holdRemoteCodeMs
        : lazyRemoteAsset
          ? lazyAssetLatencyMs
          : 0;
    if (latencyMs > 0)
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
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
