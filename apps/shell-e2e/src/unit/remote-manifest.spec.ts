import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";

test("remote manifest matches Nx build dependencies", async () => {
  const manifest: unknown = JSON.parse(
    await readFile("libs/build-config/src/remotes.json", "utf8"),
  );
  const project: unknown = JSON.parse(
    await readFile("apps/shell/project.json", "utf8"),
  );
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !project ||
    typeof project !== "object" ||
    !("targets" in project)
  )
    throw new Error("Validated manifest and project objects are required");
  const targets = project.targets;
  if (!targets || typeof targets !== "object" || !("prerender" in targets))
    throw new Error("Validated prerender target is required");
  const prerender = targets.prerender;
  if (
    !prerender ||
    typeof prerender !== "object" ||
    !("dependsOn" in prerender) ||
    !Array.isArray(prerender.dependsOn)
  )
    throw new Error("Validated dependsOn list is required");
  const projects = prerender.dependsOn.flatMap((item) =>
    typeof item === "object" &&
    item &&
    "projects" in item &&
    Array.isArray(item.projects)
      ? item.projects
      : [],
  );
  expect(projects.sort()).toEqual(Object.keys(manifest).sort());
  const declarations = `${await readFile("apps/home/src/remotes.d.ts", "utf8")}\n${await readFile("apps/shell/src/remotes.d.ts", "utf8")}`;
  const aliases = [
    ...declarations.matchAll(/declare module "([^/]+)\/Page"/g),
  ].map((match) => match[1]);
  const manifestAliases = Object.values(manifest);
  for (const alias of aliases) expect(manifestAliases).toContain(alias);
});
