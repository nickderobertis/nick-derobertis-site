import { access, readFile } from "node:fs/promises";
import routes from "../apps/shell/src/routes.json" with { type: "json" };
import remoteManifest from "../libs/build-config/src/remotes.json" with {
  type: "json",
};
import routeContracts from "../libs/route-state/src/contracts.json" with {
  type: "json",
};

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
if (
  !Array.isArray(routes) ||
  !routes.every(
    (route) =>
      route &&
      typeof route === "object" &&
      typeof route.path === "string" &&
      /^\/(?:[a-z][a-z0-9-]*)?$/.test(route.path) &&
      typeof route.heading === "string" &&
      typeof route.description === "string",
  )
)
  throw new Error(
    "The route manifest is invalid; fix apps/shell/src/routes.json and rerun just check.",
  );
// llmlint: ignore-end[changed_behavior_has_e2e]
// llmlint: ignore-block[changed_behavior_has_e2e] These build-time artifact failure paths occur before a browser can be served; the successful artifact is exercised with JavaScript disabled and through deep links in site.spec.ts.
if (
  !remoteManifest ||
  typeof remoteManifest !== "object" ||
  Object.keys(remoteManifest).some((name) => !/^[a-z][a-z0-9-]*$/.test(name)) ||
  Object.values(remoteManifest).some((alias) => typeof alias !== "string")
)
  throw new Error(
    "The canonical remote manifest is invalid; fix libs/build-config/src/remotes.json and rerun just check.",
  );
for (const route of routes) {
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
  if (route.path !== "/") {
    const marker = realRouteMarkers[route.path];
    if (
      !marker ||
      !html.includes(marker) ||
      !html.includes(
        `${routeContracts.prerenderRouteAttribute}="${route.path}"`,
      ) ||
      html.includes('id="__TSR_DEHYDRATED__"') ||
      !html.includes("$_TSR.router=") ||
      !html.includes("$_TSR.e()")
    )
      throw new Error(
        `${path} lacks real route markup or TanStack Router hydration state; inspect scripts/render-entry.tsx and rerun just prerender.`,
      );
  }
}
const fallback = await readFile(`${root}/404.html`, "utf8");
if (!fallback.includes("Loading requested page"))
  throw new Error("404 fallback is not intentional");
for (const name of Object.keys(remoteManifest)) {
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
