import { access, readFile } from "node:fs/promises";
import {
  inlineRemoteCssPattern,
  parseRemoteManifest,
  readRouteRemoteStyles,
  remotesForRoute,
  routeContracts,
  routeSubstantiveContent,
  validatePagesBase,
} from "@site/artifact-contracts";
import remoteManifest from "@site/build-config/remotes.json" with {
  type: "json",
};
import siteConfig from "@site/data-access-core/site.config.json" with {
  type: "json",
};
import { JSDOM } from "jsdom";
// llmlint: ignore[boundary_inputs_validated] The imported document is never read here. Its only use is `const validatedRoutes = parseRoutes(routes)` below, which holds it to an array of route records each carrying a `path` matching `/^\/(?:[a-z][a-z0-9-]*)?$/`, a `heading` string, a `description` string, and an optional `remote` name before anything downstream reads a field; `parseRoutes` rejects with the path to apps/shell/src/routes.json and the command to rerun.
import routes from "../../apps/shell/src/routes.json" with { type: "json" };

process.on("uncaughtException", (error) => {
  console.error(
    `check-static-artifact: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});

// Every prerendered document has to carry its own route's real content, and
// @site/artifact-contracts derives that content from the CV data the artifact
// itself ships: compose stages libs/data-access-core/vendor/codegen at
// `cv-data`. The browser journeys read the same contract, so what this refuses
// at compose time is what a visitor is shown.
// What each route document must contain to prove the real remote rendered into
// it rather than a stand-in. Each is the class list that route's own page shell
// renders: the `pane` class the shared design-system primitive publishes,
// followed by the class the remote adds. A route whose markup lost either half
// is a route composed from something other than the shipped component.
const realRouteMarkers = {
  "/bio": 'class="pane bio-page"',
  "/research": 'class="pane research-page"',
  "/software": 'class="pane software-page"',
  "/courses": 'class="pane courses-page"',
};

// llmlint: ignore-block[changed_behavior_has_e2e] This override exists only so static-artifact.spec.ts can corrupt an isolated assembled artifact and exercise its failure diagnostics; site.spec.ts drives the successful default artifact in a real browser with and without JavaScript.
const root = process.env.STATIC_ARTIFACT_ROOT ?? "dist/apps/shell";
if (typeof root !== "string" || root.length === 0 || root.includes("\0"))
  throw new Error(
    "STATIC_ARTIFACT_ROOT must be a non-empty filesystem path; fix it and rerun just prerender.",
  );
// llmlint: ignore-end[changed_behavior_has_e2e]

// llmlint: ignore-block[changed_behavior_has_e2e] This gate runs before the artifact is served and fails the compose lane, so nothing it rejects reaches a visitor; composed-artifact.spec.ts drives the artifact it passes in a real browser from a content-store-shaped compose, and static-artifact.spec.ts drives this exact rejection over a real artifact with one asset removed.
const pagesBase = validatePagesBase(siteConfig?.pagesBase);
// Pages serves the artifact under the project base path, so resolving a
// reference the way the browser does means resolving it against the document's
// served URL. Any origin stands in for github.io here; only the path matters.
const artifactOrigin = "http://artifact.invalid";

/**
 * Refuses a document that points at bytes the artifact does not contain. Every
 * composed document carries a `<base href>` and root-absolute asset paths, so a
 * reference is only meaningful once it is resolved against that base and mapped
 * back through the Pages base path into the tree — which is exactly the lookup
 * the browser performs and the one a missing bundle fails.
 */
async function assertReferencedAssetsResolve(artifactPath) {
  const documentPath = `${root}/${artifactPath}`;
  const documentUrl = new URL(`${pagesBase}/${artifactPath}`, artifactOrigin);
  let rawMarkup;
  try {
    rawMarkup = await readFile(documentPath, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not read the composed document ${documentPath}: ${detail}. Fix scripts/compose/compose.mjs to write it, then rerun just prerender.`,
    );
  }
  // The inlined page CSS is checked below on its own terms and is the one part
  // of a route document that carries no asset reference. Dropping it before
  // parsing keeps this from paying for — and reporting on — a CSSOM build over
  // every remote's stylesheet.
  const markup = rawMarkup.replace(inlineRemoteCssPattern, "");
  const { document } = new JSDOM(markup, { url: documentUrl.href }).window;
  const baseUrl = new URL(
    document.querySelector("base[href]")?.getAttribute("href") ?? ".",
    documentUrl,
  );
  const references = [
    ...[...document.querySelectorAll("script[src]")].map((element) => ({
      kind: "script",
      value: element.getAttribute("src"),
    })),
    ...[...document.querySelectorAll('link[rel~="stylesheet"][href]')].map(
      (element) => ({
        kind: "stylesheet",
        value: element.getAttribute("href"),
      }),
    ),
  ];
  for (const { kind, value } of references) {
    let resolved;
    try {
      resolved = new URL(value, baseUrl);
    } catch {
      throw new Error(
        `${documentPath} references the unresolvable ${kind} ${JSON.stringify(value)}; fix scripts/compose/compose.mjs and rerun just prerender.`,
      );
    }
    // A cross-origin reference is somebody else's bytes to serve.
    if (resolved.origin !== artifactOrigin) continue;
    if (!resolved.pathname.startsWith(`${pagesBase}/`))
      throw new Error(
        `${documentPath} references the ${kind} ${value}, which resolves to ${resolved.pathname}, outside the ${pagesBase} Pages base path; fix scripts/compose/compose.mjs and rerun just prerender.`,
      );
    // The URL parser already resolved `..` against the served path, so only a
    // percent-encoded traversal could still reach outside the artifact here.
    let relative;
    try {
      relative = decodeURIComponent(resolved.pathname.slice(pagesBase.length));
    } catch {
      relative = "";
    }
    if (relative === "" || relative.split("/").includes(".."))
      throw new Error(
        `${documentPath} references the ${kind} ${value}, whose escaped path ${resolved.pathname} does not name a file inside the artifact; fix scripts/compose/compose.mjs and rerun just prerender.`,
      );
    const asset = `${root}${relative}`;
    try {
      await access(asset);
    } catch {
      throw new Error(
        `${documentPath} references the ${kind} ${value}, but the artifact contains no ${asset}; fix scripts/compose/compose.mjs to stage that app's published bytes and rerun just prerender.`,
      );
    }
  }
}
// llmlint: ignore-end[changed_behavior_has_e2e]

/**
 * The text a visitor reads in a composed document.
 *
 * Reading the parsed DOM rather than the raw markup is what makes this the same
 * question the browser journeys ask: a title React escaped into `Risk &amp;
 * Return` reads back as `Risk & Return`, and a value that only appears inside a
 * script the page ships is not something anyone was shown.
 */
function renderedText(markup) {
  const { document } = new JSDOM(markup.replace(inlineRemoteCssPattern, ""))
    .window;
  for (const script of document.querySelectorAll("script")) script.remove();
  return document.body?.textContent ?? "";
}

// llmlint: ignore-block[changed_behavior_has_e2e] Route configuration is validated before the browser artifact exists; successful routes are exercised with JavaScript disabled in site.spec.ts.
// llmlint: ignore-block[contracts_have_one_source_or_a_drift_gate] routes.json is the serialized source; this plain-Node artifact boundary cannot import the TypeScript parser, and just check runs both validators against that same source.
function parseRoutes(value) {
  if (
    !Array.isArray(value) ||
    !value.every(
      (route) =>
        route &&
        typeof route === "object" &&
        typeof route.path === "string" &&
        /^\/(?:[a-z][a-z0-9-]*)?$/.test(route.path) &&
        typeof route.heading === "string" &&
        typeof route.description === "string" &&
        (route.remote === undefined ||
          (typeof route.remote === "string" &&
            /^[a-z][a-z0-9-]*$/.test(route.remote))),
    )
  )
    throw new Error(
      "The route manifest is invalid; fix apps/shell/src/routes.json and rerun just check.",
    );
  return value;
}
// llmlint: ignore-end[contracts_have_one_source_or_a_drift_gate]
// llmlint: ignore-end[changed_behavior_has_e2e]
// llmlint: ignore-block[changed_behavior_has_e2e] These build-time artifact failure paths occur before a browser can be served; the successful artifact is exercised with JavaScript disabled and through deep links in site.spec.ts.
const validatedRoutes = parseRoutes(routes);
const validatedRemoteManifest = parseRemoteManifest(remoteManifest);
for (const route of validatedRoutes) {
  const artifactPath =
    route.path === "/" ? "index.html" : `${route.path.slice(1)}/index.html`;
  const path = `${root}/${artifactPath}`;
  const html = await readFile(path, "utf8");
  await assertReferencedAssetsResolve(artifactPath);
  if (!html.includes(`<h1`) || !html.includes(route.heading))
    throw new Error(
      `${path} lacks its expected h1 (${route.heading}); fix the route renderer and rerun just prerender.`,
    );
  if (!html.includes("/nick-derobertis-site/"))
    throw new Error(
      `${path} lacks the Pages base path; fix the route renderer and rerun just prerender.`,
    );
  const rendered = renderedText(html);
  for (const expected of routeSubstantiveContent(`${root}/cv-data`, route.path))
    if (!rendered.includes(expected))
      throw new Error(
        `${path} lacks substantive route content (${expected}); fix scripts/compose/compose.mjs and rerun just check.`,
      );
  // The prerendered markup only paints styled at first load when every remote
  // it renders has its page CSS inline ahead of the deferred federation scripts.
  const deferredScripts = html.indexOf("<script defer");
  for (const { css, names } of await readRouteRemoteStyles({
    remoteRoot: `${root}/remotes`,
    pagesBase: siteConfig?.pagesBase,
    routePath: route.path,
  })) {
    const inlined = html.indexOf(css);
    if (inlined === -1)
      throw new Error(
        `${path} lacks the inlined ${names.join(", ")} page CSS; fix scripts/compose/compose.mjs and rerun just prerender.`,
      );
    if (deferredScripts === -1 || inlined > deferredScripts)
      throw new Error(
        `${path} inlines the ${names.join(", ")} page CSS after its deferred scripts; fix scripts/compose/compose.mjs and rerun just prerender.`,
      );
  }
  if (route.path !== "/") {
    if (!route.remote || !remotesForRoute(route.path).includes(route.remote))
      throw new Error(
        `${path} does not inline the page CSS of its own ${route.remote ?? "route"} remote; align libs/artifact-contracts/src/remote-css.ts with apps/shell/src/routes.json and rerun just prerender.`,
      );
    const marker = realRouteMarkers[route.path];
    if (!marker || !html.includes(marker))
      throw new Error(
        `${path} lacks its real component marker (${marker ?? "undefined"}); rebuild the ${route.remote} fragment and rerun just prerender.`,
      );
    const routeAttribute = `${routeContracts.prerenderRouteAttribute}="${route.path}"`;
    if (!html.includes(routeAttribute))
      throw new Error(
        `${path} lacks ${routeAttribute}; fix scripts/compose/compose.mjs and rerun just prerender.`,
      );
    if (html.includes('id="__TSR_DEHYDRATED__"'))
      throw new Error(
        `${path} contains the unsupported legacy __TSR_DEHYDRATED__ state; use TanStack Router serialization and rerun just prerender.`,
      );
    if (!html.includes("$_TSR.router="))
      throw new Error(
        `${path} lacks the TanStack Router serialized state; rebuild the shell fragment and rerun just prerender.`,
      );
    if (!html.includes("$_TSR.e()"))
      throw new Error(
        `${path} lacks the TanStack Router hydration completion call; rebuild the shell fragment and rerun just prerender.`,
      );
  }
}
// The home document prerenders every pane the home host composes, so its
// inlined CSS set has to track home's own built federation manifest instead of a
// hand-kept list that a new pane could silently outgrow.
const homeManifestPath = `${root}/remotes/home/mf-manifest.json`;
let homeManifest;
try {
  homeManifest = JSON.parse(await readFile(homeManifestPath, "utf8"));
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(
    `Could not read the home federation manifest at ${homeManifestPath}: ${detail}. Rebuild the home remote, then rerun just prerender.`,
  );
}
const composedByHome = new Set();
for (const remote of Array.isArray(homeManifest?.remotes)
  ? homeManifest.remotes
  : []) {
  const name = /\/remotes\/([a-z][a-z0-9-]*)\/remoteEntry\.js$/.exec(
    typeof remote?.entry === "string" ? remote.entry : "",
  )?.[1];
  if (!name)
    throw new Error(
      `${homeManifestPath} declares a remote without a project-path entry; rebuild the home remote and rerun just prerender.`,
    );
  composedByHome.add(name);
}
if (composedByHome.size === 0)
  throw new Error(
    `${homeManifestPath} declares no composed remotes; rebuild the home remote and rerun just prerender.`,
  );
const declaredForHome = remotesForRoute("/");
const uncoveredPanes = ["home", ...composedByHome].filter(
  (name) => !declaredForHome.includes(name),
);
if (uncoveredPanes.length > 0)
  throw new Error(
    `${root}/index.html does not inline the page CSS of every remote the home host composes (missing ${uncoveredPanes.join(", ")}); add them to libs/artifact-contracts/src/remote-css.ts and rerun just prerender.`,
  );
const fallback = await readFile(`${root}/404.html`, "utf8");
if (!fallback.includes("Loading requested page"))
  throw new Error(
    "404 fallback is not intentional; restore the recovery document in scripts/compose/compose.mjs and rerun just prerender.",
  );
await assertReferencedAssetsResolve("404.html");
for (const name of Object.keys(validatedRemoteManifest)) {
  const remoteEntry = `${root}/remotes/${name}/remoteEntry.js`;
  try {
    await access(remoteEntry);
  } catch {
    throw new Error(
      `${remoteEntry} is missing; rebuild the ${name} remote and rerun just prerender.`,
    );
  }
  await assertReferencedAssetsResolve(`remotes/${name}/index.html`);
}
for (const file of [
  "cv.json",
  "cv.schema.json",
  "index.d.ts",
  "domains/awards.json",
  "domains/courses.json",
  "domains/research.json",
  "domains/skills.json",
  "domains/software_projects.json",
  "domains/timeline.json",
]) {
  const cvPath = `${root}/cv-data/${file}`;
  try {
    await access(cvPath);
  } catch {
    throw new Error(
      `${cvPath} is missing; rebuild the CV data artifact and rerun just prerender.`,
    );
  }
}
// llmlint: ignore-end[changed_behavior_has_e2e]
