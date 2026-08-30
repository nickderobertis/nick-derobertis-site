import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { runInNewContext } from "node:vm";
import { parseRemoteManifest } from "@site/artifact-contracts";
import remoteManifest from "@site/build-config/remotes.json" with {
  type: "json",
};
// Compose owns the route composition this gate sums over, so the route
// budgets are derived from the same declaration compose builds documents
// from rather than a second list that could drift away from it. This is a
// sibling tooling module reached by path, the way this project already
// reaches apps/shell/src/routes.json from check-static-artifact.mjs.
import { routeFragments } from "../compose/compose.mjs";
import {
  BudgetRefusal,
  deriveCeiling,
  parseBundleBudgets,
} from "./bundle-budgets.mjs";

// llmlint: ignore-block[changed_behavior_has_e2e] This handler formats the gate's own diagnostic and sets its exit status; it has no browser interface, and it runs inside shell:prerender, before the compose lane can assemble an artifact, so what it reports is never something a visitor could observe. bundle-budgets.spec.ts drives its output as a real subprocess for both branches — a deliberate refusal and the unexpected failure a corrupted container raises.
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
// llmlint: ignore-end[changed_behavior_has_e2e]

// llmlint: ignore-block[changed_behavior_has_e2e] This override exists only so bundle-budgets.spec.ts can point the gate at an isolated artifact fixture and exercise its refusals; the artifact it passes is driven in a real browser by site.spec.ts and every feature journey.
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
// llmlint: ignore-end[changed_behavior_has_e2e]

/** The app whose bundle sits at the artifact root rather than under remotes/. */
const shellApp = "shell";
/** The one expose whose payload every route composes, so the one budgeted. */
const pageExpose = "./Page";

// llmlint: ignore-block[changed_behavior_has_e2e] The measurement helpers below refuse a bundle they cannot measure, and none of those refusals has a browser interface: each one fails shell:prerender before the compose lane can assemble an artifact, so a bundle they reject is one no visitor ever receives. bundle-budgets.spec.ts drives the reachable refusal — a container whose chunk resolver reads a host global — as a real subprocess over an isolated artifact fixture; the rest guard against a bundler emitting a runtime or a document this workspace has never produced, which no browser could be pointed at. The artifact these helpers do measure is driven in a real browser by site.spec.ts on both render paths.
/**
 * The resolver expression, checked before it is evaluated rather than after.
 * It comes out of a build artifact, so what may be executed is stated here as a
 * shape: an arrow function of one parameter whose body, once its string
 * literals are removed, names nothing but that parameter. That admits the
 * concatenations and chunk-id maps a bundler emits — `e=>"common.9f2.js"`,
 * `e=>""+({5:"a"})[e]+".js"` — and refuses anything that could call out to a
 * host global, so nothing unvalidated ever reaches runInNewContext.
 */
function validatedResolverExpression(expression) {
  const refuse = (detail) => {
    throw new BudgetRefusal(
      `A bundle runtime declares a chunk filename resolver that ${detail}. Rebuild the artifact and rerun just prerender.`,
    );
  };
  if (expression.length > 8192) refuse("is longer than any bundler emits");
  const arrow = /^\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>([\s\S]*)$/.exec(
    expression,
  );
  const [, parameter = "", body = ""] = arrow ?? [];
  if (!parameter) refuse("is not an arrow function of one parameter");
  if (body.includes("`")) refuse("interpolates a template literal");
  const withoutStrings = body
    .replace(/"(?:[^"\\]|\\.)*"/g, "")
    .replace(/'(?:[^'\\]|\\.)*'/g, "");
  for (const [name] of withoutStrings.matchAll(/[A-Za-z_$][\w$]*/g))
    if (name !== parameter) refuse(`reads ${name}, which is not its parameter`);
  return expression;
}

/**
 * Reads the chunk-id-to-filename function a bundle's own runtime carries.
 * Which file a chunk id names is the bundler's decision, not a naming
 * convention: an id can be renamed (`5` becomes `common`), can carry no
 * JavaScript at all, and the mapping changes shape with the chunks a build
 * emits. So the id is resolved with the very function the browser resolves it
 * with, extracted by scanning the expression's own brackets rather than by
 * guessing where it ends.
 */
function chunkFileResolver(source) {
  const marker = "__webpack_require__.u=";
  const start = source.indexOf(marker);
  if (start === -1) return undefined;
  let index = start + marker.length;
  let depth = 0;
  let quote = "";
  for (; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[" || character === "{") depth += 1;
    else if (character === ")" || character === "]" || character === "}") {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && (character === ";" || character === ",")) break;
  }
  const expression = validatedResolverExpression(
    source.slice(start + marker.length, index),
  );
  const resolve = runInNewContext(`(${expression})`, Object.create(null), {
    timeout: 1000,
  });
  if (typeof resolve !== "function")
    throw new BudgetRefusal(
      `A bundle runtime declares a chunk filename resolver that is not a function. Rebuild the artifact and rerun just prerender.`,
    );
  return (id) => {
    const file = resolve(id);
    return typeof file === "string" ? file : undefined;
  };
}

/**
 * Every chunk id a bundle asks its runtime to fetch. A chunk that belongs to
 * another container resolves to a filename this app never emitted, and is
 * dropped below rather than counted against this app's budget.
 */
function requestedChunkIds(source) {
  return [...source.matchAll(/\.e\("([^"\\]{1,32})"\)/g)].flatMap(([, id]) =>
    id === undefined ? [] : [id],
  );
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

/**
 * The scripts an app's own document loads before anything else runs. This is
 * the eager entry: what a visitor pays for reaching the app at all, ahead of
 * any route or pane it goes on to resolve.
 */
async function entryScripts(directory, emitted) {
  const documentPath = join(directory, "index.html");
  const document = await readFile(documentPath, "utf8");
  const scripts = [...document.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(
    ([, reference]) => basename(reference),
  );
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

/**
 * The chunks a host has to fetch to render one of this container's exposes,
 * read from the container's own expose module map — the same map the Module
 * Federation runtime reads when a host imports `<remote>/Page`.
 */
function exposedChunkIds(container, expose) {
  const moduleMap = /moduleMap:\{([\s\S]*?)\},shareScope/.exec(container)?.[1];
  if (moduleMap === undefined) return undefined;
  const entry = moduleMap
    .split(/(?="\.\/)/)
    .find((segment) => segment.startsWith(`"${expose}":`));
  return entry === undefined ? undefined : requestedChunkIds(entry);
}

async function measureApp(directory) {
  const emitted = new Set(
    (await readdir(directory)).filter((file) => file.endsWith(".js")),
  );
  const measured = {
    entry: await totalBytes(
      directory,
      await reachableJsFiles(
        directory,
        await entryScripts(directory, emitted),
        emitted,
      ),
    ),
  };
  if (!emitted.has("remoteEntry.js")) return measured;
  const container = await readFile(join(directory, "remoteEntry.js"), "utf8");
  const resolve = chunkFileResolver(container);
  const exposed = exposedChunkIds(container, pageExpose);
  if (!exposed || !resolve) return measured;
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
// llmlint: ignore-end[changed_behavior_has_e2e]

// llmlint: ignore-block[changed_behavior_has_e2e] Every refusal below happens before the artifact is served and fails the compose lane, so a payload it rejects never reaches a visitor; bundle-budgets.spec.ts drives each one — the unrecognised argument, the chunk over its ceiling, and the budget file missing an app — as a real subprocess over isolated artifact fixtures, and site.spec.ts drives the artifact this gate passes.
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
  const rederived = { ...declared };
  rederived.apps = Object.fromEntries(
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
  );
  rederived.routes = Object.fromEntries(
    Object.entries(measuredRoutes).map(([route, bytes]) => [
      route,
      deriveCeiling(bytes, budgets.marginPercent),
    ]),
  );
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
// llmlint: ignore-end[changed_behavior_has_e2e]
