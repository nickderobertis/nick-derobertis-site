import { readFile } from "node:fs/promises";
import { z } from "zod";
import routes from "../apps/shell/src/routes.json" with { type: "json" };

async function readRequired(path, recovery) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Could not read ${path}. ${recovery}`, { cause: error });
  }
}

const routeSchema = z.array(
  z.object({ remote: z.string().min(1).optional() }).passthrough(),
);
const routeResult = routeSchema.safeParse(routes);
if (!routeResult.success)
  throw new Error(
    `Invalid apps/shell/src/routes.json remote configuration. Give each route an optional non-empty string "remote" field, then rerun the shell prerender. Details: ${z.prettifyError(routeResult.error)}`,
  );
const validatedRoutes = routeResult.data;
const routeRemoteNames = validatedRoutes.flatMap((route) => route.remote ?? []);
const uniqueRouteRemoteNames = new Set(routeRemoteNames);
if (uniqueRouteRemoteNames.size !== routeRemoteNames.length) {
  const duplicate = routeRemoteNames.find(
    (name, index) => routeRemoteNames.indexOf(name) !== index,
  );
  throw new Error(
    `Remote ${JSON.stringify(duplicate)} appears more than once in apps/shell/src/routes.json. Remove the duplicate entry or rename one remote, then rerun the shell prerender.`,
  );
}

const projectPath = "apps/shell/project.json";
let projectInput;
try {
  projectInput = JSON.parse(await readFile(projectPath, "utf8"));
} catch (error) {
  throw new Error(
    `Could not parse ${projectPath} as JSON. Correct its JSON syntax, then rerun the shell prerender.`,
    { cause: error },
  );
}
const projectSchema = z.object({
  targets: z.object({
    prerender: z.object({
      dependsOn: z.tuple([
        z.unknown(),
        z.object({ projects: z.array(z.string().min(1)) }),
      ]),
    }),
  }),
});
const projectResult = projectSchema.safeParse(projectInput);
if (!projectResult.success)
  throw new Error(
    `Invalid ${projectPath} prerender configuration. Set targets.prerender.dependsOn[1].projects to a list of non-empty remote project names, then rerun the shell prerender. Details: ${z.prettifyError(projectResult.error)}`,
  );
const project = projectResult.data;
const dependencies = project.targets.prerender.dependsOn[1].projects;
const uniqueDependencies = new Set(dependencies);
if (uniqueDependencies.size !== dependencies.length)
  throw new Error(
    "Remove duplicate projects from the shell prerender dependencies",
  );
for (const name of routeRemoteNames)
  if (!uniqueDependencies.has(name))
    throw new Error(`Add ${name} to the shell prerender project dependencies`);
const declarations = await readRequired(
  "apps/shell/src/remotes.d.ts",
  "Restore the shell remote declarations, then rerun the shell prerender.",
);
const shellApp = await readRequired(
  "apps/shell/src/app.tsx",
  "Restore the shell application entry point, then rerun the shell prerender.",
);
for (const name of dependencies) {
  if (!declarations.includes(`declare module "${name}/Page"`))
    throw new Error(
      `Declare the ${name}/Page federation module in apps/shell/src/remotes.d.ts`,
    );
  if (!shellApp.includes(`import("${name}/Page")`))
    throw new Error(
      `Load the ${name}/Page federation module with React.lazy in apps/shell/src/app.tsx`,
    );
}
