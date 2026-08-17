import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Adding a federated remote used to mean agreeing edits in four root files, and
 * this contract checked two of them by hand, one remote at a time: a tuple list
 * for Timeline and a second for Awards, so the eleventh remote was covered only
 * if someone wrote a third. Three of those four restatements are now derived
 * from the remote's own `project.json`, and the wiring that is still written by
 * hand is held here for every remote at once — the subjects come out of the
 * project graph, so a remote added tomorrow is covered the day it is added.
 */

type ContractEntry = readonly [path: string, expected: string];

const remoteRegistry = "libs/build-config/src/remotes.json";

const projectName = z.string().regex(/^[a-z][a-z0-9-]*$/);
const workspaceDirectory = z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/);

const dependsOnSchema = z.array(
  z.union([
    z.string(),
    z.object({ target: z.string(), projects: z.array(projectName) }),
  ]),
);

const projectSchema = z.object({
  root: workspaceDirectory,
  targets: z
    .record(z.string(), z.object({ dependsOn: dependsOnSchema.optional() }))
    .optional(),
  metadata: z
    .object({
      federation: z.object({ alias: z.string() }).optional(),
      boundaries: z
        .object({ onlyDependOnLibsWithTags: z.array(z.string()) })
        .optional(),
    })
    .optional(),
});

const graphSchema = z.object({
  graph: z.object({
    nodes: z.record(projectName, z.object({ data: projectSchema })),
  }),
});

type Project = z.infer<typeof projectSchema> & { name: string };

let projects: Project[] = [];
let remotes: Project[] = [];
let boundaryConstraints: {
  sourceTag: string;
  onlyDependOnLibsWithTags: string[];
}[] = [];

const aliasOf = (project: Project) => project.metadata?.federation?.alias ?? "";

beforeAll(async () => {
  const graphFile = join(
    mkdtempSync(join(tmpdir(), "federation-contract-")),
    "graph.json",
  );
  execFileSync("pnpm", ["exec", "nx", "graph", `--file=${graphFile}`], {
    encoding: "utf8",
    env: { ...process.env, NX_DAEMON: "false" },
    stdio: "pipe",
  });
  const graph = graphSchema.parse(JSON.parse(readFileSync(graphFile, "utf8")));
  projects = Object.entries(graph.graph.nodes).map(([name, node]) => ({
    name,
    ...node.data,
  }));
  remotes = projects
    .filter((project) => project.metadata?.federation)
    .sort((one, other) => one.name.localeCompare(other.name));
  // eslint.config.mjs builds its scope constraints from the same declarations,
  // so it is read as the module eslint loads rather than as text.
  const config: unknown = await import(
    pathToFileURL(resolve("eslint.config.mjs")).href
  );
  boundaryConstraints = z
    .object({
      default: z.array(
        z.object({
          rules: z
            .object({
              "@nx/enforce-module-boundaries": z.tuple([
                z.string(),
                z.object({
                  depConstraints: z.array(
                    z.object({
                      sourceTag: z.string(),
                      onlyDependOnLibsWithTags: z.array(z.string()),
                    }),
                  ),
                }),
              ]),
            })
            .optional(),
        }),
      ),
    })
    .parse(config)
    .default.flatMap(
      (entry) =>
        entry.rules?.["@nx/enforce-module-boundaries"][1].depConstraints ?? [],
    );
}, 120_000);

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

/** The `dependsOn` entry naming another project's target, if the task has one. */
function dependencyOn(project: Project, target: string, on: string) {
  return project.targets?.[target]?.dependsOn?.find(
    (entry) => typeof entry !== "string" && entry.target === on,
  );
}

describe("the canonical remote registry", () => {
  it("names exactly the remotes that declare a federation alias", async () => {
    expect(JSON.parse(await readFile(remoteRegistry, "utf8"))).toEqual(
      Object.fromEntries(
        remotes.map((remote) => [remote.name, aliasOf(remote)]),
      ),
    );
    // The shell hosts remotes rather than being one, so a registry naming it
    // would give it a federation container and a publish lane it cannot fill.
    expect(remotes.map((remote) => remote.name)).not.toContain("shell");
    expect(remotes).toHaveLength(12);
  });

  it("leaves no root file restating which projects are remotes", async () => {
    const [nxConfiguration, shell] = await Promise.all(
      ["nx.json", "apps/shell/project.json"].map((path) =>
        readFile(path, "utf8"),
      ),
    );
    // scripts/workspace/federation-plugin.mjs is what puts the fan-in back, so
    // a root file that has stopped naming remotes only because the derivation
    // was dropped would read exactly like one that never named them.
    expect(JSON.parse(nxConfiguration ?? "").plugins).toContain(
      "./scripts/workspace/federation-plugin.mjs",
    );
    const restating = remotes
      .flatMap((remote) => [
        ...(nxConfiguration?.includes(`"${remote.name}"`)
          ? [`nx.json names ${remote.name}`]
          : []),
        ...(shell?.includes(`"${remote.name}"`)
          ? [`apps/shell/project.json names ${remote.name}`]
          : []),
      ])
      .sort();
    expect(restating).toEqual([]);
  });
});

describe("the federation fan-in every app depends on", () => {
  it("makes every remote's build a prerequisite of composing the site", () => {
    const composing = projects.filter((project) => project.targets?.prerender);
    expect(composing.map((project) => project.name)).toEqual(["shell"]);
    for (const host of composing)
      expect(
        dependencyOn(host, "prerender", "build"),
        `${host.name}:prerender`,
      ).toEqual({
        target: "build",
        projects: remotes.map((remote) => remote.name),
      });
  });

  it("makes every remote's build and the composed site prerequisites of every capture", () => {
    const capturing = projects.filter((project) => project.targets?.screenshot);
    expect(capturing).toHaveLength(remotes.length);
    for (const app of capturing) {
      expect(
        dependencyOn(app, "screenshot", "build"),
        `${app.name}:screenshot`,
      ).toEqual({
        target: "build",
        projects: remotes.map((remote) => remote.name),
      });
      expect(
        dependencyOn(app, "screenshot", "prerender"),
        `${app.name}:screenshot`,
      ).toEqual({ target: "prerender", projects: ["shell"] });
    }
  });
});

describe("the module boundary every remote publishes under", () => {
  it("constrains each scope from that remote's own declaration", () => {
    expect(
      boundaryConstraints.filter((constraint) =>
        constraint.sourceTag.startsWith("scope:"),
      ),
    ).toEqual(
      remotes.map((remote) => ({
        sourceTag: `scope:${remote.name}`,
        onlyDependOnLibsWithTags:
          remote.metadata?.boundaries?.onlyDependOnLibsWithTags,
      })),
    );
  });
});

describe("the wiring each remote still declares by hand", () => {
  it("builds every remote through its own federated rspack configuration", async () => {
    await expectContract(
      remotes.map(
        (remote) =>
          [
            `apps/${remote.name}/rspack.config.ts`,
            `remoteConfig("${remote.name}"`,
          ] as const,
      ),
    );
  });

  it("composes every remote into a host and into the served document", async () => {
    const hosts = await Promise.all(
      ["apps/shell", "apps/home"].map(async (host) => ({
        composition: await readFile(`${host}/rspack.config.ts`, "utf8"),
        declarations: await readFile(`${host}/src/remotes.d.ts`, "utf8"),
      })),
    );
    // llmlint: ignore-block[tests_mirror_real_usage] Which remotes a host federates and which the compose step assembles are build-wiring facts with no interface to drive: a composition that drops a remote still produces a page that loads, and the omission surfaces as a missing fragment at deploy time. Each remote's own journey spec and site.spec.ts drive the composed result in a real browser.
    const unwired = remotes
      .filter(
        (remote) =>
          !hosts.some((host) => host.composition.includes(`"${remote.name}"`)),
      )
      .map((remote) => `${remote.name} is federated by no host`);
    const undeclared = remotes
      .filter(
        (remote) =>
          !hosts.some((host) =>
            host.declarations.includes(
              `declare module "${aliasOf(remote)}/Page"`,
            ),
          ),
      )
      .map((remote) => `${aliasOf(remote)}/Page is declared by no host`);
    const composition = await readFile("scripts/compose/compose.mjs", "utf8");
    const uncomposed = remotes
      .filter((remote) => !composition.includes(`"${remote.name}"`))
      .map((remote) => `${remote.name} is assembled into no route fragment`);
    expect([...unwired, ...undeclared, ...uncomposed]).toEqual([]);
    // llmlint: ignore-end[tests_mirror_real_usage]
  });
});

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
