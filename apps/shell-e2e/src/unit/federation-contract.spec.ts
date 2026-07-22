import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const remoteManifest = JSON.parse(
  await readFile("libs/build-config/src/remotes.json", "utf8"),
) as Record<string, string>;

const timelineContract = [
  ["apps/shell/project.json", '"timeline"'],
  ["libs/build-config/src/remotes.json", '"timeline": "timeline"'],
  ["apps/home/rspack.config.ts", '"timeline"'],
  ["apps/home/src/remotes.d.ts", 'declare module "timeline/Page"'],
  ["apps/timeline/project.json", "E2E_REMOTE=timeline"],
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
  ["apps/awards/project.json", "E2E_REMOTE=awards"],
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

function configuredRemotes(contents: string) {
  const match = contents.match(/remoteMap\(\[([\s\S]*?)\]\)/);
  const configuredList = match?.[1];
  if (!configuredList)
    throw new Error("Expected a remoteMap array in host configuration");
  return [...configuredList.matchAll(/"([a-z][a-z0-9-]*)"/g)].map(
    (remoteMatch) => {
      const remote = remoteMatch[1];
      const federationName = remote ? remoteManifest[remote] : undefined;
      if (!federationName)
        throw new Error(
          `Configured remote ${String(remote)} has no manifest entry`,
        );
      return federationName;
    },
  );
}

function declaredSkeletons(contents: string) {
  return [
    ...contents.matchAll(/declare module "([A-Za-z][A-Za-z0-9]*)\/Skeleton"/g),
  ]
    .map((match) => {
      const remote = match[1];
      if (!remote) throw new Error("Skeleton declaration has no remote name");
      return remote;
    })
    .sort();
}

describe("skeleton federation contract", () => {
  it("keeps host ambient modules aligned with configured federation remotes", async () => {
    const remoteConfig = await readFile(
      "libs/build-config/src/rspack-remote.ts",
      "utf8",
    );
    expect(remoteConfig).toContain('"./Skeleton": "./src/skeleton.tsx"');

    for (const [hostConfigPath, declarationsPath] of [
      ["apps/shell/rspack.config.ts", "apps/shell/src/remotes.d.ts"],
      ["apps/home/rspack.config.ts", "apps/home/src/remotes.d.ts"],
    ] as const) {
      const [hostConfig, declarations] = await Promise.all([
        readFile(hostConfigPath, "utf8"),
        readFile(declarationsPath, "utf8"),
      ]);
      expect(declaredSkeletons(declarations), declarationsPath).toEqual(
        configuredRemotes(hostConfig).sort(),
      );
    }
  });
});
