import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const timelineContract = [
  ["apps/shell/project.json", '"timeline"'],
  ["libs/build-config/src/remotes.json", '"timeline": "timeline"'],
  ["apps/home/rspack.config.ts", '"timeline"'],
  ["apps/home/src/remotes.d.ts", 'declare module "timeline/Page"'],
  ["apps/shell-e2e/project.json", '"timeline"'],
  ["eslint.config.mjs", 'sourceTag: "scope:timeline"'],
  ["scripts/prerender.mjs", "Object.keys(remoteManifest)"],
] as const;

describe("timeline federation contract", () => {
  it("keeps every required static Nx and federation declaration in sync", async () => {
    const declarations = await Promise.all(
      timelineContract.map(async ([path, expected]) => ({
        contents: await readFile(path, "utf8"),
        expected,
        path,
      })),
    );
    for (const declaration of declarations)
      expect(declaration.contents, declaration.path).toContain(
        declaration.expected,
      );
  });
});
