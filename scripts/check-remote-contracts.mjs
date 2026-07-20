import { readFile } from "node:fs/promises";
import routes from "../apps/shell/src/routes.json" with { type: "json" };

const names = routes.flatMap((route) => route.remote ?? []);
const uniqueNames = new Set(names);
if (uniqueNames.size !== names.length)
  throw new Error(
    "Give every remote in apps/shell/src/routes.json a unique name",
  );

const project = JSON.parse(await readFile("apps/shell/project.json", "utf8"));
const dependencies = project.targets.prerender.dependsOn[1].projects;
const declarations = await readFile("apps/shell/src/remotes.d.ts", "utf8");
for (const name of names) {
  if (!dependencies.includes(name))
    throw new Error(`Add ${name} to the shell prerender project dependencies`);
  if (!declarations.includes(`declare module "${name}/Page"`))
    throw new Error(
      `Declare the ${name}/Page federation module in apps/shell/src/remotes.d.ts`,
    );
}
if (dependencies.some((name) => !uniqueNames.has(name)))
  throw new Error(
    "Remove prerender dependencies that are absent from routes.json",
  );
