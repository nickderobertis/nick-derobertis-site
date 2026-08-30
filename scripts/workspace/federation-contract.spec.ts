import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { readdir, readFile } from "node:fs/promises";
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

const registryPath = "libs/build-config/src/remotes.json";

const projectName = z.string().regex(/^[a-z][a-z0-9-]*$/);

// The committed registry is an arbitrary JSON document until something
// narrows it, and comparing it against the graph is not that: a registry
// holding a list, or a remote mapped to something that is not an alias at
// all, would be reported as a set of remotes that disagrees with the graph
// rather than as the malformed file it is.
const registrySchema = z.record(projectName, z.string());
const workspaceDirectory = z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/);

const dependsOnSchema = z.array(
  z.union([
    z.string(),
    z.object({ target: z.string(), projects: z.array(projectName) }),
  ]),
);

const projectSchema = z.object({
  root: workspaceDirectory,
  tags: z.array(z.string()).optional(),
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

// Both the paths git prints and the declarations they hold are read back as
// evidence for how many remotes the graph must have found, so each is narrowed
// where it enters this spec rather than trusted because a committed file
// produced it.
const workspacePath = z.string().regex(/^[\w.-]+(?:\/[\w.-]+)*$/);

const declaredAppSchema = z.object({
  name: projectName,
  metadata: z
    .object({ federation: z.object({ alias: z.string() }).optional() })
    .optional(),
});

/**
 * The remotes as their own `project.json` files declare them, read off disk the
 * way `eslint.config.mjs` reads them. Every expectation in this file is checked
 * against the project graph, so how many remotes that graph should have found
 * is the one fact it cannot also supply: it comes from the declarations
 * instead, which is where a remote is added or retired in a single edit.
 */
function declaredRemoteNames() {
  return workspacePath
    .array()
    .parse(
      execFileSync("git", ["ls-files", "apps/*/project.json"], {
        encoding: "utf8",
      })
        .split("\n")
        .filter(Boolean),
    )
    .map((path) =>
      declaredAppSchema.parse(JSON.parse(readFileSync(path, "utf8"))),
    )
    .filter((declared) => declared.metadata?.federation)
    .map((declared) => declared.name)
    .sort((one, other) => one.localeCompare(other));
}

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

function dependencyOn(project: Project, target: string, on: string) {
  return project.targets?.[target]?.dependsOn?.find(
    (entry) => typeof entry !== "string" && entry.target === on,
  );
}

describe("the canonical remote registry", () => {
  it("names exactly the remotes that declare a federation alias", async () => {
    expect(
      registrySchema.parse(JSON.parse(await readFile(registryPath, "utf8"))),
    ).toEqual(
      Object.fromEntries(
        remotes.map((remote) => [remote.name, aliasOf(remote)]),
      ),
    );
    // The shell hosts remotes rather than being one, so a registry naming it
    // would give it a federation container and a publish lane it cannot fill.
    expect(remotes.map((remote) => remote.name)).not.toContain("shell");
    // A count written down here would be a fifth restatement of the list this
    // change stopped four files from keeping, so it is read from the remotes'
    // own declarations: a remote that reaches the graph without declaring
    // itself, or a declaration the graph never picked up, fails here.
    expect(remotes).toHaveLength(declaredRemoteNames().length);
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
    // JSON.parse establishes syntax and nothing else, so the one field this
    // reads is narrowed before it is read: a nx.json holding null, a list, or a
    // plugins that is not a list of paths is a finding of its own, not a
    // registration this assertion should report as missing.
    expect(
      z
        .object({ plugins: z.array(z.string()) })
        .parse(JSON.parse(nxConfiguration ?? "")).plugins,
    ).toContain("./scripts/workspace/federation-plugin.mjs");
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

/** One fabricated app: a remote when it declares an alias, a host otherwise. */
interface WrittenApp {
  federation?: { alias: string };
  /** Its rspack configuration, or nothing when the app is written without one. */
  rspack?: string;
}

/**
 * Runs the real plugin over an apps directory this spec writes, entering it
 * through `createNodesV2` — the path Nx takes, and the only one that reads a
 * `project.json` and an rspack configuration off disk. A subprocess is what
 * lets the plugin resolve `apps` from a root of this spec's own making.
 */
function deriveOverWrittenApps(apps: Readonly<Record<string, WrittenApp>>) {
  const root = mkdtempSync(join(tmpdir(), "federation-plugin-apps-"));
  try {
    for (const module of ["federation-plugin.mjs", "federation-registry.mjs"])
      cpSync(`scripts/workspace/${module}`, join(root, module));
    for (const [app, { federation, rspack }] of Object.entries(apps)) {
      mkdirSync(join(root, "apps", app), { recursive: true });
      writeFileSync(
        join(root, "apps", app, "project.json"),
        JSON.stringify({
          name: app,
          tags: federation ? [`scope:${app}`] : [],
          ...(federation
            ? {
                metadata: {
                  federation,
                  boundaries: { onlyDependOnLibsWithTags: ["type:shared"] },
                },
              }
            : {}),
          targets: { build: {}, typecheck: {} },
        }),
      );
      if (rspack !== undefined)
        writeFileSync(join(root, "apps", app, "rspack.config.ts"), rspack);
    }
    const probe = join(root, "probe.mjs");
    writeFileSync(
      probe,
      [
        'import { createNodesV2 } from "./federation-plugin.mjs";',
        `createNodesV2[1](${JSON.stringify(
          Object.keys(apps)
            .sort()
            .map((app) => `apps/${app}/project.json`),
        )});`,
        "",
      ].join("\n"),
    );
    return spawnSync(process.execPath, [probe], {
      cwd: root,
      encoding: "utf8",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

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

  it("refuses a file set that is not the project configurations it registered for", async () => {
    const plugin = await import(
      pathToFileURL(resolve("scripts/workspace/federation-plugin.mjs")).href
    );
    const [pattern, deriveDependencies] = z
      .tuple([
        z.literal("apps/*/project.json"),
        z.custom<(configFiles: unknown) => unknown>(
          (value) => typeof value === "function",
        ),
      ])
      .parse(plugin.createNodesV2);

    // Nx matches that pattern and hands the result straight in, and every entry
    // is opened off disk, so a set that did not come from it has to stop at the
    // plugin rather than reaching a read with whatever it holds.
    expect(() => deriveDependencies("apps/shell/project.json")).toThrow(
      new RegExp(`${pattern.replace(/[*.]/g, "\\$&")} files`),
    );
    expect(() =>
      deriveDependencies(["apps/shell/project.json", "../elsewhere.json"]),
    ).toThrow(/"\.\.\/elsewhere\.json"/);
    // The same call over a set Nx really would match still derives the fan-in,
    // so the check refuses the malformed set rather than the plugin's own work.
    const composed = ["build", { target: "build", projects: ["bio"] }];
    const routeRemotes = [
      {
        target: "build",
        projects: ["home", "bio", "research", "software", "courses"],
      },
    ];
    expect(
      deriveDependencies(["apps/bio/project.json", "apps/shell/project.json"]),
    ).toEqual([
      [
        "apps/bio/project.json",
        {
          projects: {
            "apps/bio": {
              targets: {
                screenshot: {
                  dependsOn: [
                    ...composed,
                    { target: "prerender", projects: ["shell"] },
                  ],
                },
              },
            },
          },
        },
      ],
      [
        "apps/shell/project.json",
        {
          projects: {
            "apps/shell": {
              targets: {
                prerender: { dependsOn: composed },
                // Read from the shell's own rspack configuration rather than
                // from the file set, which is why the build names the whole
                // route fan-in while the composed one above is only bio.
                typecheck: { dependsOn: ["build"] },
                build: { dependsOn: routeRemotes },
              },
            },
          },
        },
      ],
    ]);
  });

  it("refuses a host composing a remote no project declares", () => {
    // The remotes a host composes are read out of a TypeScript source by
    // regex, so this drives the real plugin over an apps directory whose host
    // names one that is not there -- what a mistyped remote, or a `remoteMap`
    // call the pattern matched something else in, would hand the graph.
    const derived = deriveOverWrittenApps({
      bio: { federation: { alias: "bio" }, rspack: 'remoteConfig("bio")' },
      shell: { rspack: 'remoteMap(["bio", "ghost"])' },
    });

    expect(derived.status, derived.stdout).not.toBe(0);
    expect(derived.stderr).toContain('read ["ghost"]');
    expect(derived.stderr).toContain("apps/shell/rspack.config.ts");
    expect(derived.stderr).toContain(
      "no project declares metadata.federation.alias under that name",
    );
  });

  it("refuses a host whose remoteMap call it cannot read", () => {
    // Reading nothing here would be read as a host that federates nothing, and
    // its remotes would go unbuilt before it -- a missing dependency reported
    // as an absent one, which is the failure this refuses to produce.
    const derived = deriveOverWrittenApps({
      bio: { federation: { alias: "bio" }, rspack: 'remoteConfig("bio")' },
      shell: { rspack: "remoteMap(routeRemotes)" },
    });

    expect(derived.status, derived.stdout).not.toBe(0);
    expect(derived.stderr).toContain("apps/shell/rspack.config.ts");
    expect(derived.stderr).toContain("must pass an array literal of remote");
  });

  it("names the configuration it could not open, and why", () => {
    // Every app here builds through rspack, so one with no configuration to
    // read is a project whose remotes cannot be known. Reported as the raw
    // filesystem error it is, a reader would get a path and an errno with
    // nothing saying what wanted the file or what to do about it.
    const derived = deriveOverWrittenApps({
      bio: { federation: { alias: "bio" }, rspack: 'remoteConfig("bio")' },
      shell: {},
    });

    expect(derived.status, derived.stdout).not.toBe(0);
    expect(derived.stderr).toContain("apps/shell/rspack.config.ts");
    expect(derived.stderr).toContain("which it could not open");
    expect(derived.stderr).toContain("ENOENT");
    expect(derived.stderr).toContain("rerun just check");
  });

  it("refuses a remoteMap array holding anything but remote names", () => {
    // Reading the quoted elements out of whatever the array holds would drop
    // the rest and return a shorter list, which is the same missing dependency
    // as above wearing a plausible answer.
    const derived = deriveOverWrittenApps({
      bio: { federation: { alias: "bio" }, rspack: 'remoteConfig("bio")' },
      shell: { rspack: 'remoteMap(["bio", dynamicRemote])' },
    });

    expect(derived.status, derived.stdout).not.toBe(0);
    expect(derived.stderr).toContain('passes ["dynamicRemote"]');
  });

  it("builds the remotes a host imports before the host itself", async () => {
    for (const name of ["shell", "home"]) {
      const host = projects.find((project) => project.name === name);
      expect(host, name).toBeDefined();
      if (!host) continue;
      // The host no longer restates what its remotes expose, so what it
      // consumes is read from the federated imports it writes, and the
      // schedule is held to that rather than to the plugin's own parsing.
      const modules = await hostModules(`apps/${name}/src`);
      const imported = remotes
        .filter((remote) => modules.includes(`"${aliasOf(remote)}/Page"`))
        .map((remote) => remote.name)
        .sort();
      expect(imported.length, `${name} imports no remote`).toBeGreaterThan(0);
      const scheduled = dependencyOn(host, "build", "build");
      expect(
        typeof scheduled === "string" || scheduled === undefined
          ? scheduled
          : [...scheduled.projects].sort(),
        `${name}:build`,
      ).toEqual(imported);
    }
    // A remote composes nothing, so its build stays a single app's build.
    const bio = projects.find((project) => project.name === "bio");
    expect(bio && dependencyOn(bio, "build", "build")).toBeUndefined();
  });

  it("typechecks a host against the declarations its own build consumed", () => {
    for (const name of ["shell", "home"]) {
      const host = projects.find((project) => project.name === name);
      expect(host, name).toBeDefined();
      // A host's build is what extracts each remote's published archive into
      // the directory its tsconfig resolves federated imports through, so the
      // typecheck reads what that build wrote rather than fetching anything.
      expect(host?.targets?.typecheck?.dependsOn, `${name}:typecheck`).toEqual([
        "build",
      ]);
    }
    const bio = projects.find((project) => project.name === "bio");
    expect(bio?.targets?.typecheck?.dependsOn).toBeUndefined();
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

  it("constrains a scope the remote is actually tagged with", () => {
    // The assertion above reads both sides from the same declaration, so it
    // holds just as well when the boundary enforces nothing: @nx/enforce-module-
    // boundaries applies a constraint only to the projects carrying its
    // sourceTag, and a remote whose scope: tag was renamed or dropped admits
    // every dependency the constraint was written to refuse, silently. The tags
    // come from the resolved graph rather than from project.json, because the
    // graph is the set the rule matches a source file against.
    const taggedScopes = new Map(
      projects.map((project) => [project.name, project.tags ?? []]),
    );
    const inert = boundaryConstraints
      .filter((constraint) => constraint.sourceTag.startsWith("scope:"))
      .filter(
        (constraint) =>
          !taggedScopes
            .get(constraint.sourceTag.slice("scope:".length))
            ?.includes(constraint.sourceTag),
      )
      .map(
        (constraint) =>
          `${constraint.sourceTag} is carried by no project of that name, so the boundary constrains nothing`,
      );
    expect(inert).toEqual([]);
  });
});

/**
 * Every module a host is built from, as one string to search for the federated
 * specifiers it imports. The hosts no longer restate what their remotes expose,
 * so what a host consumes is read out of the imports it actually writes.
 */
async function hostModules(directory: string) {
  const entries = await readdir(directory, { recursive: true });
  const sources = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"))
      .map((entry) => readFile(join(directory, entry), "utf8")),
  );
  return sources.join("\n");
}

describe("the wiring each remote still declares by hand", () => {
  it("builds every remote through its own federated rspack configuration", async () => {
    await expectContract(
      remotes.map(
        // `as const` because ContractEntry is a readonly two-element tuple:
        // without it this literal infers as string[], which expectContract
        // cannot destructure into [path, expected].
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
        modules: await hostModules(`${host}/src`),
      })),
    );
    const imports = hosts.map((host) => host.modules).join("\n");
    // llmlint: ignore-block[tests_mirror_real_usage] Which remotes a host federates, which exposes it imports, and which the compose step assembles are build-wiring facts with no interface to drive: a composition that drops a remote still produces a page that loads, and the omission surfaces as a missing fragment at deploy time. Each remote's own journey spec and site.spec.ts drive the composed result in a real browser.
    const unwired = remotes
      .filter(
        (remote) =>
          !hosts.some((host) => host.composition.includes(`"${remote.name}"`)),
      )
      .map((remote) => `${remote.name} is federated by no host`);
    // Each host resolves these specifiers through the declarations the remote's
    // own build compiles from its exposes, so an expose no host imports is
    // surface that is built, published, and typed for nobody.
    const unconsumed = remotes
      .filter((remote) => !imports.includes(`"${aliasOf(remote)}/Page"`))
      .map((remote) => `${aliasOf(remote)}/Page is imported by no host`);
    const skeletons = await Promise.all(
      remotes.map(async (remote) => ({
        exposed: (
          await readFile(`apps/${remote.name}/rspack.config.ts`, "utf8")
        ).includes("skeleton: true"),
        imported: imports.includes(`"${aliasOf(remote)}/Skeleton"`),
        alias: aliasOf(remote),
      })),
    );
    const straySkeletons = skeletons
      .filter((skeleton) => skeleton.exposed !== skeleton.imported)
      .map(
        (skeleton) =>
          `${skeleton.alias}/Skeleton is ${skeleton.exposed ? "exposed but imported by no host" : "imported by a host but exposed by no remote"}`,
      );
    const composition = await readFile("scripts/compose/compose.mjs", "utf8");
    const uncomposed = remotes
      .filter((remote) => !composition.includes(`"${remote.name}"`))
      .map((remote) => `${remote.name} is assembled into no route fragment`);
    expect([
      ...unwired,
      ...unconsumed,
      ...straySkeletons,
      ...uncomposed,
    ]).toEqual([]);
    // llmlint: ignore-end[tests_mirror_real_usage]
  });
});

// The shell reaches home/Page across the federation boundary, so the remote's
// preload export and the router wiring that calls it have to move together.
// Home warms its panes from the module that owns them and re-exports that
// warming at its route boundary, which is the surface the shell reaches. The
// explicit tuple typing keeps every entry compatible with expectContract.
const homePreloadContract: ReadonlyArray<ContractEntry> = [
  ["apps/home/src/panes.ts", "export function preload(): Promise<void>"],
  ["apps/home/src/page.tsx", 'export { preload } from "./panes"'],
  [
    "apps/shell/src/main.tsx",
    "homePreload: async () => (await loadHome()).preload()",
  ],
  ["apps/shell/src/router.tsx", "homePreload?: () => Promise<void>"],
  ["apps/awards/src/page.tsx", "export { preloadAwards as preload }"],
  ["apps/awards/src/use-awards.ts", "export async function preloadAwards()"],
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
