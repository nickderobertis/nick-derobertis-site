import { access, readFile } from "node:fs/promises";
import routes from "../apps/shell/src/routes.json" with { type: "json" };
import remoteManifest from "../libs/build-config/src/remotes.json" with {
  type: "json",
};
import siteConfig from "../libs/data-access-core/src/site.config.json" with {
  type: "json",
};
import { readRouteRemoteStyles, remotesForRoute } from "./remote-css.mjs";
import { parseRemoteManifest, routeContracts } from "./route-contracts.mjs";

const substantiveRouteContent = {
  "/": "Who am I?",
  "/bio": "Reproducible Research",
  "/research": "Valuation without Cash Flows",
  "/software": "Python Tools for Working with Data",
  "/courses": "Financial Modeling",
};
const realRouteMarkers = {
  "/bio": 'class="bio-page"',
  "/research": 'class="research-page"',
  "/software": 'class="software-page"',
  "/courses": 'class="courses-page"',
};

const root = "dist/apps/shell";
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
  const path =
    route.path === "/"
      ? `${root}/index.html`
      : `${root}${route.path}/index.html`;
  const html = await readFile(path, "utf8");
  if (!html.includes(`<h1`) || !html.includes(route.heading))
    throw new Error(
      `${path} lacks its expected h1 (${route.heading}); fix the route renderer and rerun just prerender.`,
    );
  if (!html.includes("/nick-derobertis-site/"))
    throw new Error(`${path} lacks the Pages base path`);
  const expected = substantiveRouteContent[route.path];
  if (!expected || !html.includes(expected))
    throw new Error(
      `${path} lacks substantive route content; fix scripts/prerender.mjs and rerun just check.`,
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
        `${path} lacks the inlined ${names.join(", ")} page CSS; fix scripts/prerender.mjs and rerun just prerender.`,
      );
    if (deferredScripts === -1 || inlined > deferredScripts)
      throw new Error(
        `${path} inlines the ${names.join(", ")} page CSS after its deferred scripts; fix scripts/prerender.mjs and rerun just prerender.`,
      );
  }
  if (route.path !== "/") {
    if (!route.remote || !remotesForRoute(route.path).includes(route.remote))
      throw new Error(
        `${path} does not inline the page CSS of its own ${route.remote ?? "route"} remote; align scripts/remote-css.mjs with apps/shell/src/routes.json and rerun just prerender.`,
      );
    const marker = realRouteMarkers[route.path];
    if (!marker || !html.includes(marker))
      throw new Error(
        `${path} lacks its real component marker (${marker ?? "undefined"}); fix scripts/render-entry.tsx and rerun just prerender.`,
      );
    const routeAttribute = `${routeContracts.prerenderRouteAttribute}="${route.path}"`;
    if (!html.includes(routeAttribute))
      throw new Error(
        `${path} lacks ${routeAttribute}; fix scripts/prerender.mjs and rerun just prerender.`,
      );
    if (html.includes('id="__TSR_DEHYDRATED__"'))
      throw new Error(
        `${path} contains the unsupported legacy __TSR_DEHYDRATED__ state; use TanStack Router serialization and rerun just prerender.`,
      );
    if (!html.includes("$_TSR.router="))
      throw new Error(
        `${path} lacks the TanStack Router serialized state; fix scripts/render-entry.tsx and rerun just prerender.`,
      );
    if (!html.includes("$_TSR.e()"))
      throw new Error(
        `${path} lacks the TanStack Router hydration completion call; fix scripts/render-entry.tsx and rerun just prerender.`,
      );
  }
}
// The home document prerenders every pane the home host composes, so its
// inlined CSS set has to track home's own built federation manifest instead of a
// hand-kept list that a new pane could silently outgrow.
const homeManifest = JSON.parse(
  await readFile(`${root}/remotes/home/mf-manifest.json`, "utf8"),
);
const composedByHome = new Set();
for (const remote of Array.isArray(homeManifest?.remotes)
  ? homeManifest.remotes
  : []) {
  const name = /\/remotes\/([a-z][a-z0-9-]*)\/remoteEntry\.js$/.exec(
    typeof remote?.entry === "string" ? remote.entry : "",
  )?.[1];
  if (!name)
    throw new Error(
      `${root}/remotes/home/mf-manifest.json declares a remote without a project-path entry; rebuild the home remote and rerun just prerender.`,
    );
  composedByHome.add(name);
}
if (composedByHome.size === 0)
  throw new Error(
    `${root}/remotes/home/mf-manifest.json declares no composed remotes; rebuild the home remote and rerun just prerender.`,
  );
const declaredForHome = remotesForRoute("/");
const uncoveredPanes = ["home", ...composedByHome].filter(
  (name) => !declaredForHome.includes(name),
);
if (uncoveredPanes.length > 0)
  throw new Error(
    `${root}/index.html does not inline the page CSS of every remote the home host composes (missing ${uncoveredPanes.join(", ")}); add them to scripts/remote-css.mjs and rerun just prerender.`,
  );
const fallback = await readFile(`${root}/404.html`, "utf8");
if (!fallback.includes("Loading requested page"))
  throw new Error("404 fallback is not intentional");
for (const name of Object.keys(validatedRemoteManifest)) {
  const remoteEntry = `${root}/remotes/${name}/remoteEntry.js`;
  try {
    await access(remoteEntry);
  } catch {
    throw new Error(
      `${remoteEntry} is missing; rebuild the ${name} remote and rerun just prerender.`,
    );
  }
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
])
  await access(`${root}/cv-data/${file}`);
// llmlint: ignore-end[changed_behavior_has_e2e]
