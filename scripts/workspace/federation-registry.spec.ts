import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * `scripts/workspace/federation-registry.mjs` is the one place a federated
 * remote's declaration is read, and `scripts/workspace/generate-remote-registry.mjs`
 * is the CLI that turns those declarations into
 * `libs/build-config/src/remotes.json`. Neither has a browser interface: they
 * decide which remotes exist before anything is built, so a declaration either
 * refuses to build or produces the artifact every journey spec already drives.
 *
 * The grammar cases run the real module in a real Node process against
 * fabricated project declarations, which is the only way to reach a workspace
 * that declares two remotes under one alias or none at all. The two cases below
 * them go the other way: they drive the contributor's own commands over the
 * committed tree, so the derivation is observed where a push actually meets it.
 */

const registryPath = "libs/build-config/src/remotes.json";
const scratch: string[] = [];

afterEach(() => {
  for (const root of scratch.splice(0))
    rmSync(root, { force: true, recursive: true });
});

/** One project.json document, as a project reaches the registry's boundary. */
function project(
  name: string,
  metadata: unknown,
  tags: readonly string[] = [],
) {
  return { name, metadata, tags };
}

function remote(name: string, alias: string, admits: readonly string[]) {
  return project(
    name,
    {
      federation: { alias },
      boundaries: { onlyDependOnLibsWithTags: admits },
    },
    ["type:remote", `scope:${name}`],
  );
}

/**
 * Runs the real registry module in its own Node process against the project
 * configurations the caller fabricated, entering it through the same
 * `declaredProject` boundary the plugin and the generator both enter through.
 */
function derive(configurations: readonly unknown[]) {
  const root = mkdtempSync(join(tmpdir(), "federation-registry-"));
  scratch.push(root);
  cpSync(
    "scripts/workspace/federation-registry.mjs",
    join(root, "federation-registry.mjs"),
  );
  const probe = join(root, "probe.mjs");
  writeFileSync(
    probe,
    [
      'import { declaredProject, federationRemotes, moduleBoundaryConstraints, remoteRegistry } from "./federation-registry.mjs";',
      // The probe reads one JSON document out of argv and turns the name inside
      // it into a path, both of which it does before the module under test is
      // entered, so both are checked here rather than downstream of them.
      "const configurations = JSON.parse(process.argv[2]);",
      "if (!Array.isArray(configurations))",
      '  throw new Error("probe takes one JSON array of project configurations, not " + process.argv[2]);',
      "const sourceOf = (configuration, index) =>",
      '  typeof configuration?.name === "string" && /^[a-z][a-z0-9-]*$/.test(configuration.name)',
      '    ? "apps/" + configuration.name + "/project.json"',
      '    : "the fabricated project configuration at index " + index;',
      "const projects = configurations.map((configuration, index) =>",
      "  declaredProject(configuration, sourceOf(configuration, index)),",
      ");",
      "const remotes = federationRemotes(projects);",
      "process.stdout.write(JSON.stringify({ registry: remoteRegistry(remotes), constraints: moduleBoundaryConstraints(remotes) }));",
      "",
    ].join("\n"),
  );
  return spawnSync(process.execPath, [probe, JSON.stringify(configurations)], {
    encoding: "utf8",
  });
}

/**
 * Runs the real registry over an apps directory this spec writes, entering it
 * through `declaredAppProjects` — the path eslint.config.mjs takes, and the
 * only one that reads a `project.json` off disk rather than being handed a
 * document that has already parsed.
 */
function deriveOverWrittenApps(documents: Readonly<Record<string, string>>) {
  const root = mkdtempSync(join(tmpdir(), "federation-registry-apps-"));
  scratch.push(root);
  cpSync(
    "scripts/workspace/federation-registry.mjs",
    join(root, "federation-registry.mjs"),
  );
  for (const [name, contents] of Object.entries(documents)) {
    mkdirSync(join(root, "apps", name), { recursive: true });
    writeFileSync(join(root, "apps", name, "project.json"), contents);
  }
  const probe = join(root, "probe.mjs");
  writeFileSync(
    probe,
    [
      'import { declaredAppProjects, federationRemotes, remoteRegistry } from "./federation-registry.mjs";',
      'process.stdout.write(JSON.stringify(remoteRegistry(federationRemotes(declaredAppProjects("apps")))));',
      "",
    ].join("\n"),
  );
  return spawnSync(process.execPath, [probe], { cwd: root, encoding: "utf8" });
}

/**
 * Runs the real generator CLI over a project graph this spec fabricates, by
 * shadowing the `pnpm exec nx graph` it shells out to with a stub that writes
 * the caller's graph to the file the CLI asked Nx for.
 *
 * Nx cannot be made to print an entry that is not a project node, so the
 * narrowing the CLI does before it reads a node's root is only reachable from
 * here — and it is the boundary that decides whether a malformed graph is
 * reported as one or read as a project.
 *
 * `commit` writes the registry the CLI compares its derivation against, which
 * the committed tree can never be left holding: a registry that has stopped
 * being readable is only reachable from a workspace this spec builds. The
 * registry it wrote comes back, because the CLI's other path rewrites that file
 * and what it did to it is the observation.
 */
// llmlint: ignore-block[work_goes_through_command_surface] The CLI boundary is the subject of every case below: the arguments it recognises, the exit status it answers with, and the stderr it names a cause in. `just generate-remote-registry` cannot reach any of them — it takes no arguments, runs against the committed workspace rather than a disposable tree whose `pnpm exec nx graph` is stubbed, and rewrites the committed registry, which is exactly the file these cases hold unchanged. The recipe is the surface for the work it performs, and the two cases over the committed tree at the end of this file drive it as one.
function generateFromGraph(
  graph: unknown,
  commit?: (path: string) => void,
  invocation: readonly string[] = ["--check"],
) {
  const root = mkdtempSync(join(tmpdir(), "remote-registry-graph-"));
  scratch.push(root);
  for (const module of [
    "federation-registry.mjs",
    "generate-remote-registry.mjs",
  ])
    cpSync(`scripts/workspace/${module}`, join(root, module));
  const registry = join(root, registryPath);
  mkdirSync(dirname(registry), { recursive: true });
  commit?.(registry);
  const bin = join(root, "bin");
  mkdirSync(bin);
  // The path is cut off the flag rather than stripped with a shell parameter
  // expansion, which inside a JavaScript string reads as a template placeholder
  // that was never interpolated.
  writeFileSync(
    join(bin, "pnpm"),
    [
      "#!/bin/sh",
      'for argument in "$@"; do',
      '  case "$argument" in',
      '    --file=*) printf %s "$GRAPH" > "$(printf %s "$argument" | cut -d= -f2-)" ;;',
      "  esac",
      "done",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  return {
    registry,
    ...spawnSync(
      process.execPath,
      ["generate-remote-registry.mjs", ...invocation],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          GRAPH: JSON.stringify(graph),
          PATH: `${bin}:${process.env.PATH ?? ""}`,
        },
      },
    ),
  };
}
// llmlint: ignore-end[work_goes_through_command_surface]

// Both the paths git prints and the declarations they hold are read back as
// evidence for what the generated registry must contain, so each is narrowed
// where it enters this spec rather than trusted because a committed file
// produced it: a declaration this spec cannot read is the finding.
const workspacePath = z.string().regex(/^[\w.-]+(?:\/[\w.-]+)*$/);

const declaredProjectSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  metadata: z
    .object({
      federation: z
        .object({ alias: z.string().regex(/^[a-z][A-Za-z]*$/) })
        .optional(),
    })
    .optional(),
});

const derived = z.object({
  registry: z.record(z.string(), z.string()),
  constraints: z.array(
    z.object({
      sourceTag: z.string(),
      onlyDependOnLibsWithTags: z.array(z.string()),
    }),
  ),
});

describe("the federation declaration each remote owns", () => {
  it("derives the registry and the module boundary from the remotes alone", () => {
    const result = derive([
      remote("home-cards", "homeCards", ["type:shared", "data:home"]),
      remote("bio", "bio", ["type:shared"]),
      // The shell declares no federation, because it hosts remotes rather than
      // being one; it must reach neither the registry nor a scope constraint.
      project("shell", { description: "the host" }),
    ]);

    expect(result.status, result.stderr).toBe(0);
    expect(derived.parse(JSON.parse(result.stdout))).toEqual({
      registry: { bio: "bio", "home-cards": "homeCards" },
      constraints: [
        { sourceTag: "scope:bio", onlyDependOnLibsWithTags: ["type:shared"] },
        {
          sourceTag: "scope:home-cards",
          onlyDependOnLibsWithTags: ["type:shared", "data:home"],
        },
      ],
    });
  });

  it.each([
    [
      "an alias that could not be a Module Federation container name",
      [remote("awards", "awards-container", ["type:shared"])],
      /declares the federation alias "awards-container"/,
    ],
    [
      "a remote name that could not be a content-store subtree path",
      [remote("home2", "home", ["type:shared"])],
      /declares a federated remote named "home2"/,
    ],
    [
      "a federation declaration that is not an object",
      [project("awards", { federation: "awards" })],
      /declares a metadata.federation that is not an object/,
    ],
    [
      "no boundary tags for the scope the remote publishes under",
      [project("awards", { federation: { alias: "awards" } })],
      /declares no metadata.boundaries.onlyDependOnLibsWithTags/,
    ],
    [
      "a boundary tag that could not be an Nx tag",
      [remote("awards", "awards", ["type:shared", "Data Core"])],
      /declares no metadata.boundaries.onlyDependOnLibsWithTags/,
    ],
    [
      "a remote carrying no scope tag for the boundary it publishes",
      [
        {
          ...remote("awards", "awards", ["type:shared"]),
          tags: ["type:remote", "scope:prizes"],
        },
      ],
      /none of which is the scope:awards tag/,
    ],
    [
      "a tag that could not be an Nx tag",
      [
        {
          ...remote("awards", "awards", ["type:shared"]),
          tags: ["Scope Awards"],
        },
      ],
      /declares a tags that is not a list of Nx tags/,
    ],
    [
      "two remotes claiming one federation container",
      [
        remote("awards", "awards", ["type:shared"]),
        remote("prizes", "awards", ["type:shared"]),
      ],
      /both declare the federation alias "awards"/,
    ],
    [
      "no federated remote at all",
      [project("shell", { description: "the host" })],
      /No project declares metadata.federation.alias/,
    ],
  ])("refuses a workspace declaring %s", (_case, projects, reason) => {
    const result = derive(projects);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(reason);
  });
});

describe("a project.json the registry reads off disk", () => {
  it("derives the registry from the apps directory eslint resolves", () => {
    const result = deriveOverWrittenApps({
      bio: JSON.stringify(remote("bio", "bio", ["type:shared"])),
      shell: JSON.stringify(project("shell", { description: "the host" })),
    });

    expect(result.status, result.stderr).toBe(0);
    // The shell is read off the same directory and declares no federation, so
    // reaching the registry through disk must still tell a host from a remote.
    expect(
      z.record(z.string(), z.string()).parse(JSON.parse(result.stdout)),
    ).toEqual({ bio: "bio" });
  });

  it("names the file and the next action when one cannot be parsed", () => {
    const result = deriveOverWrittenApps({ bio: '{ "name": "bio", }' });

    expect(result.status).not.toBe(0);
    // eslint and the Nx plugin both enter here, and a bare parser diagnostic
    // reaches them naming neither the project that broke nor what to do next.
    expect(result.stderr).toMatch(
      /apps\/bio\/project\.json could not be read as JSON: .+\. Fix that project's declaration and rerun just check\./,
    );
  });
});

describe("the project graph the generator derives the registry from", () => {
  it.each([
    [
      "a graph carrying no project nodes",
      { graph: { nodes: [] } },
      /printed no project nodes/,
    ],
    [
      "an entry that is not a project node",
      { graph: { nodes: { bio: "apps/bio" } } },
      /reported the project "bio" as "apps\/bio", which is not a project node/,
    ],
    [
      "a project node carrying no configuration",
      { graph: { nodes: { bio: { data: null } } } },
      /reported the project "bio" with no project configuration/,
    ],
    [
      "a project node rooted outside the workspace",
      { graph: { nodes: { bio: { data: { root: "../bio" } } } } },
      /reported the project "bio" at "\.\.\/bio", which is not a workspace-relative directory/,
    ],
  ])("refuses %s", (_case, graph, reason) => {
    const result = generateFromGraph(graph);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(reason);
  });

  it("reports the reason Nx itself refused to resolve the graph", () => {
    const result = generateFromGraph(undefined);

    expect(result.status).not.toBe(0);
    // The stub writes nothing when there is no graph to write, so the CLI's own
    // read of the file Nx was asked for is what fails here.
    expect(result.stderr).toMatch(/generate-remote-registry: /);
  });
});

describe("the committed registry the generator compares against", () => {
  /** One remote, as a node of the graph the CLI reads projects out of. */
  const bioGraph = {
    graph: {
      nodes: {
        bio: {
          data: {
            name: "bio",
            root: "apps/bio",
            tags: ["type:remote", "scope:bio"],
            metadata: {
              federation: { alias: "bio" },
              boundaries: { onlyDependOnLibsWithTags: ["type:shared"] },
            },
          },
        },
      },
    },
  };

  it("refuses an argument it does not recognise rather than rewriting the file", () => {
    const committed = '{\n  "bio": "biography"\n}\n';

    const result = generateFromGraph(
      bioGraph,
      (path) => writeFileSync(path, committed),
      ["--chekc"],
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/takes only --check.+not "--chekc"/);
    // The next action is the one that applies: nothing here is a declaration a
    // contributor could correct, so sending them to one names the wrong file.
    expect(result.stderr).toContain(
      "Correct the argument, then rerun just generate-remote-registry.",
    );
    expect(result.stderr).not.toContain("correct the declaration");
    // Not recognising --check is what selects the write path, so a flag typed
    // wrong by a contributor asking whether the registry had drifted would have
    // answered by making it agree.
    expect(readFileSync(result.registry, "utf8")).toBe(committed);
  });

  it("reports drift only when the file it read actually disagrees", () => {
    const clean = generateFromGraph(bioGraph, (path) =>
      writeFileSync(path, '{\n  "bio": "bio"\n}\n'),
    );
    expect(clean.status, clean.stderr).toBe(0);

    const drifted = generateFromGraph(bioGraph, (path) =>
      writeFileSync(path, '{\n  "bio": "biography"\n}\n'),
    );
    expect(drifted.status).not.toBe(0);
    expect(drifted.stderr).toMatch(
      new RegExp(`${registryPath} disagrees with the remotes`),
    );
  });

  it.each([
    [
      "a registry that is not JSON",
      (path: string) => writeFileSync(path, "{ bio: bio }"),
      /remotes\.json is not readable as JSON: /,
    ],
    [
      "a registry that is not a mapping",
      (path: string) => writeFileSync(path, '["bio"]\n'),
      /remotes\.json is not a JSON object mapping each remote's project name/,
    ],
    [
      "a registry naming something no remote could be",
      (path: string) => writeFileSync(path, '{ "Bio": "bio" }\n'),
      /remotes\.json maps "Bio" to "bio", which is not a remote's project name/,
    ],
    [
      "a registry whose alias no container could carry",
      (path: string) => writeFileSync(path, '{ "bio": "bio-container" }\n'),
      /remotes\.json maps "bio" to "bio-container", which is not a remote's/,
    ],
    [
      "a registry that cannot be read at all",
      (path: string) => mkdirSync(path),
      /remotes\.json could not be read: /,
    ],
  ])(
    "names %s as the cause rather than reporting it as drift",
    (_case, commit, reason) => {
      const result = generateFromGraph(bioGraph, commit);

      expect(result.status).not.toBe(0);
      // Every one of these makes the comparison fail, so reporting drift would
      // send a contributor to a derivation that is doing exactly its job.
      expect(result.stderr).toMatch(reason);
      expect(result.stderr).not.toMatch(/disagrees with the remotes/);
      // The file this run could not read is the one to restore, and it is the
      // committed registry rather than any project declaration.
      expect(result.stderr).toContain("rerun just generate-remote-registry");
      expect(result.stderr).not.toContain("correct the declaration");
    },
  );
});

describe("the canonical registry the workspace commits", () => {
  it("is regenerated from the project graph exactly as it is committed", () => {
    const committed = readFileSync(registryPath, "utf8");

    const result = spawnSync("just", ["generate-remote-registry"], {
      encoding: "utf8",
    });

    expect(result.status, `${result.stderr}${result.stdout}`).toBe(0);
    expect(readFileSync(registryPath, "utf8")).toBe(committed);
    // The registry is the fact each remote declares, so it has to be exactly
    // the aliases the remotes declare — not merely a file the CLI rewrote.
    expect(
      z.record(z.string(), z.string()).parse(JSON.parse(committed)),
    ).toEqual(
      Object.fromEntries(
        workspacePath
          .array()
          .parse(
            spawnSync("git", ["ls-files", "apps/*/project.json"], {
              encoding: "utf8",
            })
              .stdout.split("\n")
              .filter(Boolean),
          )
          .map((path) =>
            declaredProjectSchema.parse(JSON.parse(readFileSync(path, "utf8"))),
          )
          .filter((declared) => declared.metadata?.federation)
          .flatMap((declared) =>
            declared.metadata?.federation
              ? [[declared.name, declared.metadata.federation.alias]]
              : [],
          ),
      ),
    );
  }, 120_000);

  it("fails the push gate when a remote's declared alias drifts from it", () => {
    // A remote's alias is read by nothing but the derivations under test, so
    // moving it is the drift a rename would cause and is inert to every other
    // gate running beside this one; the committed file is restored either way.
    const declaration = "apps/bio/project.json";
    const original = readFileSync(declaration, "utf8");
    expect(original).toContain('"alias": "bio"');

    const result = (() => {
      try {
        writeFileSync(
          declaration,
          original.replace('"alias": "bio"', '"alias": "biography"'),
        );
        return spawnSync("just", ["lint-workflows"], { encoding: "utf8" });
      } finally {
        writeFileSync(declaration, original);
      }
    })();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `${registryPath} disagrees with the remotes the project graph declares`,
    );
  }, 120_000);
});
