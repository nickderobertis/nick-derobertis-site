import { access, readFile } from "node:fs/promises";
import { z } from "zod";
import shellProject from "../apps/shell/project.json" with { type: "json" };
import routes from "../apps/shell/src/routes.json" with { type: "json" };
import { siteRemoteNames as remoteNames } from "../libs/build-config/src/site-remotes.ts";

const root = "dist/apps/shell";
const parsedShellProject = z
  .object({
    targets: z.object({
      prerender: z.object({
        dependsOn: z.array(
          z.union([
            z.string(),
            z.object({ projects: z.array(z.string()) }).passthrough(),
          ]),
        ),
      }),
    }),
  })
  .parse(shellProject);
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
}
const fallback = await readFile(`${root}/404.html`, "utf8");
if (!fallback.includes("Loading requested page"))
  throw new Error("404 fallback is not intentional");
const prerenderDependencies =
  parsedShellProject.targets.prerender.dependsOn.find(
    (dependency) => typeof dependency === "object",
  )?.projects;
if (JSON.stringify(prerenderDependencies) !== JSON.stringify(remoteNames))
  throw new Error(
    "Shell prerender dependencies drifted from libs/build-config/src/site-remotes.ts; update apps/shell/project.json to match the registry.",
  );
for (const name of remoteNames) {
  try {
    await access(`${root}/remotes/${name}/remoteEntry.js`);
  } catch (error) {
    throw new Error(
      `The ${name} remote is missing from the static site; run \`pnpm exec nx run shell:prerender\` to rebuild it.`,
      { cause: error },
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
