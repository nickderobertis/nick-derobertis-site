import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

type ContractEntry = readonly [path: string, expected: string];

const timelineContract: ReadonlyArray<ContractEntry> = [
  // llmlint: ignore[tests_mirror_real_usage] Which remotes compose.mjs assembles is a build-wiring fact with no interface to drive: a composition that drops Timeline produces a page that still loads, and the omission only surfaces as a missing fragment at deploy time. The composed page is driven through the real browser by timeline.spec.ts and site.spec.ts.
  ["scripts/compose/compose.mjs", '"timeline"'],
  ["libs/build-config/src/remotes.json", '"timeline": "timeline"'],
  ["apps/home/rspack.config.ts", '"timeline"'],
  ["apps/home/src/remotes.d.ts", 'declare module "timeline/Page"'],
  ["apps/timeline/project.json", "apps/timeline/e2e/playwright.config.ts"],
  ["eslint.config.mjs", 'sourceTag: "scope:timeline"'],
  // llmlint: ignore[tests_mirror_real_usage] That compose.mjs iterates the validated manifest instead of a hardcoded list is the same wiring contract, invisible from the browser until a newly added remote silently goes uncomposed; compose.spec.ts drives the real exported composition API over it.
  ["scripts/compose/compose.mjs", "Object.keys(validatedRemoteManifest)"],
];

const awardsContract: ReadonlyArray<ContractEntry> = [
  ["apps/awards/project.json", '"name": "awards"'],
  ["apps/awards/rspack.config.ts", 'remoteConfig("awards")'],
  ["apps/home/rspack.config.ts", '"awards"'],
  ["apps/home/src/panes.ts", 'import("awards/Page")'],
  ["apps/home/src/remotes.d.ts", 'declare module "awards/Page"'],
  // llmlint: ignore[tests_mirror_real_usage] Same composition contract for Awards: nothing a visitor can do reveals whether compose.mjs names this remote, and awards.spec.ts plus home.spec.ts drive the composed result through the real browser on both render paths.
  ["scripts/compose/compose.mjs", '"awards"'],
  ["apps/awards/project.json", "apps/awards/e2e/playwright.config.ts"],
  ["libs/build-config/src/remotes.json", '"awards": "awards"'],
];

// The shell declares home/Page ambiently, so the remote's preload export, the
// host's declaration of it, and the router wiring have to move together. Home
// warms its panes from the module that owns them and re-exports that warming at
// its route boundary, which is the surface the shell reaches. The explicit
// tuple typing keeps every declaration compatible with expectContract.
const homePreloadContract: ReadonlyArray<ContractEntry> = [
  ["apps/home/src/panes.ts", "export function preload(): Promise<void>"],
  ["apps/home/src/page.tsx", 'export { preload } from "./panes"'],
  ["apps/shell/src/remotes.d.ts", "export function preload(): Promise<void>;"],
  [
    "apps/shell/src/main.tsx",
    "homePreload: async () => (await loadHome()).preload()",
  ],
  ["apps/shell/src/router.tsx", "homePreload?: () => Promise<void>"],
  ["apps/awards/src/page.tsx", "export { preloadAwards as preload }"],
  ["apps/awards/src/use-awards.ts", "export async function preloadAwards()"],
  ["apps/home/src/remotes.d.ts", "export function preload(): Promise<void>;"],
  ["apps/home/src/panes.ts", "await awards.preload()"],
];

const bioContract: ReadonlyArray<ContractEntry> = [
  ["apps/bio/src/biography.tsx", 'id="bio-heading">Optimizing Life'],
  ["apps/bio/e2e/bio.spec.ts", 'name: "Optimizing Life"'],
  ["libs/e2e-harness/src/site-contract.ts", 'heading: "Optimizing Life"'],
];

async function expectContract(contract: ReadonlyArray<ContractEntry>) {
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

describe("home preload federation contract", () => {
  it("keeps the remote export, host declaration, and router wiring in sync", async () => {
    await expectContract(homePreloadContract);
  });
});

describe("bio content contract", () => {
  it("keeps the remote and browser heading expectations in sync", async () => {
    await expectContract(bioContract);
  });
});
