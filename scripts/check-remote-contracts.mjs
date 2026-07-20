import { readFile } from "node:fs/promises";
import { z } from "zod";
import routes from "../apps/shell/src/routes.json" with { type: "json" };

const validatedRoutes = z
  .array(z.object({ remote: z.string().min(1).optional() }).passthrough())
  .parse(routes);
const names = validatedRoutes.flatMap((route) => route.remote ?? []);
const uniqueNames = new Set(names);
if (uniqueNames.size !== names.length) {
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  throw new Error(
    `Remote ${JSON.stringify(duplicate)} appears more than once in routes.json`,
  );
}

const project = z
  .object({
    targets: z.object({
      prerender: z.object({
        dependsOn: z.tuple([
          z.unknown(),
          z.object({ projects: z.array(z.string().min(1)) }),
        ]),
      }),
    }),
  })
  .parse(JSON.parse(await readFile("apps/shell/project.json", "utf8")));
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
