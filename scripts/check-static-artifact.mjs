import { access, readFile } from "node:fs/promises";
import routes from "../apps/shell/src/routes.json" with { type: "json" };
import remoteManifest from "../libs/build-config/src/remotes.json" with {
  type: "json",
};

const substantiveRouteContent = {
  "/": "Who am I?",
  "/bio": "Reproducible Research",
  "/research": "Valuation without Cash Flows",
  "/software": "Python Tools for Working with Data",
  "/courses": "Financial Modeling",
};

const root = "dist/apps/shell";
for (const route of routes) {
  const path =
    route.path === "/"
      ? `${root}/index.html`
      : `${root}${route.path}/index.html`;
  const html = await readFile(path, "utf8");
  if (
    !html.includes(`<h1>${route.heading}</h1>`) ||
    !html.includes(route.description)
  )
    throw new Error(`${path} is not prerendered`);
  if (!html.includes("/nick-derobertis-site/"))
    throw new Error(`${path} lacks the Pages base path`);
  const expected = substantiveRouteContent[route.path];
  if (!expected || !html.includes(expected))
    throw new Error(`${path} lacks substantive route content`);
}
const fallback = await readFile(`${root}/404.html`, "utf8");
if (!fallback.includes("Loading requested page"))
  throw new Error("404 fallback is not intentional");
for (const name of Object.keys(remoteManifest))
  await access(`${root}/remotes/${name}/remoteEntry.js`);
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
