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

const awardsContract = [
  ["apps/awards/project.json", '"name": "awards"'],
  ["apps/awards/rspack.config.ts", 'remoteConfig("awards")'],
  ["apps/home/rspack.config.ts", '"awards"'],
  ["apps/home/src/page.tsx", 'import("awards/Page")'],
  ["apps/home/src/remotes.d.ts", 'declare module "awards/Page"'],
  ["apps/shell/project.json", '"awards"'],
  ["apps/shell-e2e/project.json", '"awards"'],
  ["libs/build-config/src/remotes.json", '"awards": "awards"'],
] as const;

const bioContract = [
  ["apps/bio/src/page.tsx", 'id="bio-heading">Optimizing Life'],
  ["apps/shell-e2e/src/bio.spec.ts", 'name: "Optimizing Life"'],
  ["apps/shell-e2e/src/site.spec.ts", 'heading: "Optimizing Life"'],
] as const;

async function expectContract(
  contract: readonly (readonly [path: string, expected: string])[],
) {
  const declarations = await Promise.all(
    contract.map(async ([path, expected]) => ({
      contents: await readFile(path, "utf8"),
      expected,
      path,
    })),
  );
  for (const declaration of declarations)
    expect(declaration.contents, declaration.path).toContain(
      declaration.expected,
    );
}

describe("timeline federation contract", () => {
  it("keeps every required static Nx and federation declaration in sync", async () => {
    await expectContract(timelineContract);
  });
});

describe("awards federation contract", () => {
  it("keeps every required Nx, host, and federation declaration in sync", async () => {
    await expectContract(awardsContract);
  });
});

describe("bio content contract", () => {
  it("keeps the remote and browser heading expectations in sync", async () => {
    await expectContract(bioContract);
  });
});
