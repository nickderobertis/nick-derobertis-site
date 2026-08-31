import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseRemoteManifest } from "@site/artifact-contracts";
import remoteManifest from "@site/build-config/remotes.json" with {
  type: "json",
};
// The Pages base path arrives already held to `/[a-z0-9-]+` by the module that
// owns it, so this gate resolves references against the same validated base the
// builds emitting them were configured with.
import { siteBase } from "@site/data-access-core/site";
// Compose owns the route composition this gate sums over, so the route
// budgets are derived from the same declaration compose builds documents
// from rather than a second list that could drift away from it. This is a
// sibling tooling module reached by path, the way this project already
// reaches apps/shell/src/routes.json from check-static-artifact.mjs.
import { routeFragments } from "../compose/compose.mjs";
import {
  BudgetRefusal,
  chunkFileResolver,
  deriveCeiling,
  exposedChunkIds,
  parseBundleBudgets,
  requestedChunkIds,
} from "./bundle-budgets.mjs";

// llmlint: ignore-file[changed_behavior_has_e2e] This gate has no browser
// interface. It runs inside shell:prerender, ahead of the compose lane, so a
// payload or an artifact it refuses is one no document was assembled from and
// no visitor is ever served, and its --rederive mode rewrites a committed build
// input from a developer's terminal for a reviewer to weigh. bundle-budgets.spec.ts
// drives every one of those paths through this real CLI as a subprocess over
// isolated artifact fixtures — the unrecognised argument, the budget file
// missing an app, a container whose chunk resolver reaches for a host global, a
// pane and the route composing it over their ceilings, and the re-derivation
// itself; site.spec.ts drives the artifact this gate passes in a real browser
// with and without JavaScript.

// A refusal already ends with the action that clears it. Anything else landing
// here is unexpected — an unreadable chunk, a budget file that is not JSON — and
// says nothing about what to do next, so the recovery step is appended to it.
process.on("uncaughtException", (error) => {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(
    error instanceof BudgetRefusal
      ? `check-bundle-budgets: ${reason}`
      : `check-bundle-budgets: ${reason}. The artifact at ${root} or the budgets at ${budgetsPath} could not be read as expected; rebuild with just prerender, and rerun this gate.`,
  );
  process.exit(1);
});

const root = process.env.STATIC_ARTIFACT_ROOT ?? "dist/apps/shell";
const budgetsPath =
  process.env.BUNDLE_BUDGETS ?? "scripts/artifact/bundle-budgets.json";
for (const [name, value] of [
  ["STATIC_ARTIFACT_ROOT", root],
  ["BUNDLE_BUDGETS", budgetsPath],
])
  if (typeof value !== "string" || value.length === 0 || value.includes("\0"))
    throw new BudgetRefusal(
      `${name} must be a non-empty filesystem path; fix it and rerun just prerender.`,
    );

/** The app whose bundle sits at the artifact root rather than under remotes/. */
const shellApp = "shell";
/** The one expose whose payload every route composes, so the one budgeted. */
const pageExpose = "./Page";

// Pages serves the artifact under the project base path, so resolving a script
// reference the way the browser does means resolving it against the URL the
// document is served from. Any origin stands in for github.io here; only the
// path matters, and a reference that leaves this one left the artifact.
const artifactOrigin = "http://artifact.invalid";

/**
 * Where a browser fetches an app's own bytes from — the `publicPath` its build
 * emits references against. The shell is served at the Pages base itself and
 * every remote from its own directory beneath it, exactly as
 * libs/build-config/src/rspack-remote.ts publishes them.
 */
function appPublicPath(app) {
  return app === shellApp ? `${siteBase}/` : `${siteBase}/remotes/${app}/`;
}

/**
 * The path a reference names once it is decoded, or `undefined` when it carries
 * an escape the browser would not resolve to a path at all.
 */
function decodedPath(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
}

/**
 * Which file, if any, a document's script reference names among the bytes the
 * app emitted beside that document: `{ file }` when the browser would load it
 * out of the app's own served directory, and `{ elsewhere }` — a clause naming
 * where it would go instead — when it would not.
 *
 * The reference is resolved and then mapped back through that directory rather
 * than reduced to its last path segment. `<site base>/main.js` and
 * `../home/main.js` both end in a name a sibling app's directory may well
 * contain, so a gate reading the segment alone would count another app's bytes,
 * or bytes no app emitted, against this app's ceiling.
 */
function resolvedEntryScript(reference, publicPath, documentUrl) {
  let resolved;
  try {
    resolved = new URL(reference, documentUrl);
  } catch {
    return {
      elsewhere: "is not a URL a browser could resolve against this document",
    };
  }
  if (resolved.origin !== artifactOrigin)
    return { elsewhere: "is served from another origin" };
  // The URL parser already resolved `..` against the served path, so only a
  // percent-encoded traversal could still reach outside the app's directory.
  const file = resolved.pathname.startsWith(publicPath)
    ? decodedPath(resolved.pathname.slice(publicPath.length))
    : undefined;
  return file === undefined || file === "" || file.includes("/")
    ? {
        elsewhere: `resolves to ${resolved.pathname}, outside the ${publicPath} directory this app emitted`,
      }
    : { file };
}

/**
 * Everything loading `files` pulls in: each file, plus every chunk reachable
 * from it through the runtime that loads it, shared chunks included. Payload
 * moved out of a chunk and into one it imports stays inside this set, so it
 * still counts against the same ceiling.
 */
async function reachableJsFiles(directory, files, emitted) {
  const reached = new Set();
  const queue = files.map((file) => ({ file, resolve: undefined }));
  // Draining with `pop` hands each entry over already narrowed, so the closure
  // below needs no assertion about what an empty queue would have yielded. Which
  // end it drains from is free: this walks a reachability set, not an order.
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    const { file, resolve } = next;
    if (reached.has(file)) continue;
    reached.add(file);
    const source = await readFile(join(directory, file), "utf8");
    // A runtime chunk resolves the ids raised inside it and inside every chunk
    // it goes on to load, exactly as one page's webpack runtime does.
    const resolveHere = chunkFileResolver(source) ?? resolve;
    if (!resolveHere) continue;
    for (const id of requestedChunkIds(source)) {
      const chunk = resolveHere(id);
      // A chunk id with no emitted JavaScript — a CSS-only expose chunk, or
      // another container's — carries none of this app's bytes.
      if (chunk && emitted.has(chunk))
        queue.push({ file: chunk, resolve: resolveHere });
    }
  }
  return reached;
}

async function totalBytes(directory, files) {
  let bytes = 0;
  for (const file of files) bytes += (await stat(join(directory, file))).size;
  return bytes;
}

async function manifestPageChunks(directory) {
  const manifestPath = join(directory, "mf-manifest.json");
  let source;
  try {
    source = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw new BudgetRefusal(
      `${manifestPath} could not be read: ${error instanceof Error ? error.message : String(error)}. Rebuild that app and rerun just prerender.`,
    );
  }
  let manifest;
  try {
    manifest = JSON.parse(source);
  } catch (error) {
    throw new BudgetRefusal(
      `${manifestPath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}. Rebuild that app and rerun just prerender.`,
    );
  }
  const exposes = manifest?.exposes;
  if (!Array.isArray(exposes))
    throw new BudgetRefusal(
      `${join(directory, "mf-manifest.json")} has no exposes array; rebuild that app and rerun just prerender.`,
    );
  const page = exposes.find((expose) => expose?.path === pageExpose);
  const sync = page?.assets?.js?.sync;
  const async = page?.assets?.js?.async;
  if (!Array.isArray(sync) || !Array.isArray(async))
    throw new BudgetRefusal(
      `${join(directory, "mf-manifest.json")} declares no ${pageExpose} JavaScript assets; rebuild that app and rerun just prerender.`,
    );
  const chunks = [...sync, ...async];
  if (
    !chunks.every((chunk) => typeof chunk === "string" && !chunk.includes("/"))
  )
    throw new BudgetRefusal(
      `${join(directory, "mf-manifest.json")} names ${pageExpose} assets outside the app's published root; rebuild that app and rerun just prerender.`,
    );
  return chunks;
}

/**
 * The scripts an app's own document loads before anything else runs. This is
 * the eager entry: what a visitor pays for reaching the app at all, ahead of
 * any route or pane it goes on to resolve.
 */
async function entryScripts(directory, emitted, publicPath) {
  const documentPath = join(directory, "index.html");
  const document = await readFile(documentPath, "utf8");
  // A reference is resolved the way the browser resolves it, against the URL
  // this document is served from, and is only an entry script when it comes
  // back naming a file inside this app's own directory. One that does not is
  // refused rather than counted: a script served from another origin, or from
  // another app's directory beside this one, would otherwise land on this app's
  // ceiling whenever its last path segment matched a file this app did emit.
  const documentUrl = new URL(`${publicPath}index.html`, artifactOrigin);
  const scripts = [];
  // Every spelling HTML allows for the attribute is read — either quote, none
  // at all, either case, whitespace around the `=` — not just the one this
  // workspace's bundler happens to emit: a source this gate cannot see is
  // payload it would leave out of the ceiling rather than budget.
  for (const [, quoted, singleQuoted, bare] of document.matchAll(
    /<script\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )) {
    const reference = quoted ?? singleQuoted ?? bare ?? "";
    const { file, elsewhere } = resolvedEntryScript(
      reference,
      publicPath,
      documentUrl,
    );
    if (file === undefined)
      throw new BudgetRefusal(
        `${documentPath} loads ${reference}, which ${elsewhere}, so the bytes it carries are not this app's to budget; rebuild that app and rerun just prerender.`,
      );
    scripts.push(file);
  }
  if (scripts.length === 0)
    throw new BudgetRefusal(
      `${documentPath} loads no script, so its eager entry cannot be measured; rebuild that app and rerun just prerender.`,
    );
  for (const script of scripts)
    if (!emitted.has(script))
      throw new BudgetRefusal(
        `${documentPath} loads ${script}, which ${directory} does not contain; rebuild that app and rerun just prerender.`,
      );
  return scripts;
}

async function measureApp(directory, publicPath) {
  const emitted = new Set(
    (await readdir(directory)).filter((file) => file.endsWith(".js")),
  );
  const measured = {
    entry: await totalBytes(
      directory,
      await reachableJsFiles(
        directory,
        await entryScripts(directory, emitted, publicPath),
        emitted,
      ),
    ),
  };
  if (!emitted.has("remoteEntry.js")) return measured;
  const container = await readFile(join(directory, "remoteEntry.js"), "utf8");
  const resolve = chunkFileResolver(container);
  const exposed = exposedChunkIds(container, pageExpose);
  if (!exposed || exposed.length === 0) {
    const manifestChunks = await manifestPageChunks(directory);
    if (manifestChunks) {
      for (const chunk of manifestChunks)
        if (!emitted.has(chunk))
          throw new BudgetRefusal(
            `${join(directory, "mf-manifest.json")} declares ${pageExpose} chunk ${chunk}, which ${directory} does not contain; rebuild that app and rerun just prerender.`,
          );
      return {
        ...measured,
        page: await totalBytes(
          directory,
          await reachableJsFiles(directory, manifestChunks, emitted),
        ),
      };
    }
  }
  // A container whose expose map or chunk resolver cannot be read is refused
  // rather than measured as an app with no page: passing it through would
  // budget a remote at zero, and --rederive would write that zero down as the
  // ceiling a host's route composes.
  if (!resolve)
    throw new BudgetRefusal(
      `${join(directory, "remoteEntry.js")} carries no chunk filename resolver, so the ${pageExpose} payload a host composes from it cannot be measured; rebuild that app and rerun just prerender.`,
    );
  if (!exposed || exposed.length === 0)
    throw new BudgetRefusal(
      `${join(directory, "remoteEntry.js")} declares no ${pageExpose} chunk in its expose module map, so the payload a host composes from it cannot be measured; rebuild that app and rerun just prerender.`,
    );
  const chunks = exposed
    .map((id) => resolve(id))
    .filter((chunk) => chunk !== undefined && emitted.has(chunk));
  return {
    ...measured,
    page: await totalBytes(
      directory,
      await reachableJsFiles(directory, chunks, emitted),
    ),
  };
}

// The CLI shape is validated before anything is read: an unrecognised flag is
// a caller asking for something this gate does not do, and silently gating
// instead would report a pass the caller never requested.
const flags = process.argv.slice(2);
const rederiving = flags.length === 1 && flags[0] === "--rederive";
if (flags.length > 0 && !rederiving)
  throw new BudgetRefusal(
    `check-bundle-budgets accepts no arguments, or --rederive to rewrite ${budgetsPath} from the tree in front of it; it was given ${flags.join(" ")}. Rerun node scripts/artifact/check-bundle-budgets.mjs with no arguments to gate the artifact, or with --rederive to move the ceilings.`,
  );

// The file is read once and validated once: the re-derive below rewrites this
// same value rather than reading it again, so nothing is serialized from a
// parse no boundary checked, or from a file that changed between two reads.
const declared = JSON.parse(await readFile(budgetsPath, "utf8"));
const budgets = parseBundleBudgets(declared, budgetsPath);
const declaredRemotes = Object.keys(parseRemoteManifest(remoteManifest));
// Staged app subtrees are resolved through `stat` rather than by directory
// entry type, because an isolated artifact fixture links the app subtrees it
// does not corrupt instead of copying them. Each name is checked against the
// declared registry as it is read, so nothing measures a directory the
// workspace never declared as a remote.
const stagedRemotes = [];
for (const entry of await readdir(join(root, "remotes"))) {
  if (!(await stat(join(root, "remotes", entry))).isDirectory()) continue;
  if (!declaredRemotes.includes(entry))
    throw new BudgetRefusal(
      `${root}/remotes carries ${entry}, which libs/build-config/src/remotes.json does not declare as a remote; rebuild the artifact and rerun just prerender.`,
    );
  stagedRemotes.push(entry);
}
const artifactApps = [shellApp, ...stagedRemotes];
const routePaths = Object.keys(routeFragments);

// Coverage is settled before a byte is measured. Every app the registry
// declares owes a budget, and no app may reach the artifact unbudgeted: an app
// missing from either side is refused rather than measured against nothing.
// Re-deriving is exempt, because the file it is about to rewrite is the very
// one whose coverage these checks would be reading.
if (!rederiving) {
  const unbudgeted = [...new Set([...declaredRemotes, ...artifactApps])].filter(
    (app) => !(app in budgets.apps),
  );
  if (unbudgeted.length > 0)
    throw new BudgetRefusal(
      `${budgetsPath} declares no budget for ${unbudgeted.join(", ")}; re-derive the ceilings with node scripts/artifact/check-bundle-budgets.mjs --rederive and commit the result, then rerun just prerender.`,
    );
  const unknownApps = Object.keys(budgets.apps).filter(
    (app) => !artifactApps.includes(app),
  );
  if (unknownApps.length > 0)
    throw new BudgetRefusal(
      `${budgetsPath} budgets ${unknownApps.join(", ")}, which the artifact at ${root} does not contain; align the budgets with libs/build-config/src/remotes.json and rerun just prerender.`,
    );
  const unbudgetedRoutes = routePaths.filter(
    (route) => !(route in budgets.routes),
  );
  const unknownRoutes = Object.keys(budgets.routes).filter(
    (route) => !routePaths.includes(route),
  );
  if (unbudgetedRoutes.length > 0 || unknownRoutes.length > 0)
    throw new BudgetRefusal(
      `${budgetsPath} budgets the routes ${Object.keys(budgets.routes).join(", ")}, but compose composes ${routePaths.join(", ")}; align the budgets with scripts/compose/compose.mjs and rerun just prerender.`,
    );
}

const measuredApps = {};
for (const app of artifactApps)
  measuredApps[app] = await measureApp(
    app === shellApp ? root : join(root, "remotes", app),
    appPublicPath(app),
  );
const measuredRoutes = Object.fromEntries(
  Object.entries(routeFragments).map(([route, names]) => [
    route,
    names.reduce((sum, name) => sum + (measuredApps[name]?.page ?? 0), 0),
  ]),
);

// Re-deriving is how a ceiling moves: this rewrites the committed file with
// every ceiling recomputed from the tree in front of it, so a change that
// alters a payload deliberately lands as a diff a reader can weigh.
if (rederiving) {
  // Built from what the boundary read, never from the raw parse: a property
  // `declared` carries that nothing validated would otherwise be written back
  // into the committed file as though something had.
  const rederived = {
    ...(budgets.derivation === undefined
      ? {}
      : { derivation: budgets.derivation }),
    marginPercent: budgets.marginPercent,
    apps: Object.fromEntries(
      artifactApps
        .toSorted()
        .map((app) => [
          app,
          Object.fromEntries(
            Object.entries(measuredApps[app]).map(([kind, bytes]) => [
              kind,
              deriveCeiling(bytes, budgets.marginPercent),
            ]),
          ),
        ]),
    ),
    routes: Object.fromEntries(
      Object.entries(measuredRoutes).map(([route, bytes]) => [
        route,
        deriveCeiling(bytes, budgets.marginPercent),
      ]),
    ),
  };
  // What is written has to be a file this gate would accept on the next run, so
  // it goes back through the same boundary before it reaches the disk.
  parseBundleBudgets(rederived, budgetsPath);
  await writeFile(budgetsPath, `${JSON.stringify(rederived, null, 2)}\n`);
  console.log(
    `check-bundle-budgets: re-derived ${artifactApps.length} app and ${routePaths.length} route ceilings into ${budgetsPath}`,
  );
  process.exit(0);
}

const violations = [];
for (const [app, measured] of Object.entries(measuredApps)) {
  const budget = budgets.apps[app];
  for (const [kind, label] of [
    ["entry", "eager entry"],
    ["page", `${pageExpose} chunk`],
  ]) {
    if (measured[kind] === undefined && budget[kind] === undefined) continue;
    if (measured[kind] === undefined || budget[kind] === undefined) {
      violations.push(
        `${app} ${budget[kind] === undefined ? `exposes a ${label} the budgets do not declare` : `declares a ${label} budget for bytes the artifact does not contain`}`,
      );
      continue;
    }
    if (measured[kind] > budget[kind].ceilingBytes)
      violations.push(
        `${app} ${label} is ${measured[kind]} bytes, over its ${budget[kind].ceilingBytes}-byte ceiling`,
      );
  }
}
for (const [route, bytes] of Object.entries(measuredRoutes))
  if (bytes > budgets.routes[route].ceilingBytes)
    violations.push(
      `route ${route} composes ${bytes} bytes of ${pageExpose} chunks, over its ${budgets.routes[route].ceilingBytes}-byte ceiling`,
    );

if (violations.length > 0)
  throw new BudgetRefusal(
    `The composed artifact exceeds its committed bundle budgets:\n${violations.map((violation) => `  ${violation}`).join("\n")}\nRemove the payload, or re-derive every ceiling with node scripts/artifact/check-bundle-budgets.mjs --rederive and commit the result.`,
  );
