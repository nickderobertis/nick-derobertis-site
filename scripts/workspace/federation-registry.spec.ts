import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

/** A project as the Nx project graph hands it to the registry. */
function project(name: string, metadata: unknown) {
  return {
    name,
    configuration: { metadata },
    source: `apps/${name}/project.json`,
  };
}

function remote(name: string, alias: string, tags: readonly string[]) {
  return project(name, {
    federation: { alias },
    boundaries: { onlyDependOnLibsWithTags: tags },
  });
}

/**
 * Runs the real registry module in its own Node process against the projects
 * the caller fabricated, the way the plugin and the generator both reach it.
 */
function derive(projects: readonly unknown[]) {
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
      'import { federationRemotes, moduleBoundaryConstraints, remoteRegistry } from "./federation-registry.mjs";',
      "const remotes = federationRemotes(JSON.parse(process.argv[2]));",
      "process.stdout.write(JSON.stringify({ registry: remoteRegistry(remotes), constraints: moduleBoundaryConstraints(remotes) }));",
      "",
    ].join("\n"),
  );
  return spawnSync(process.execPath, [probe, JSON.stringify(projects)], {
    encoding: "utf8",
  });
}

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
    expect(JSON.parse(committed)).toEqual(
      Object.fromEntries(
        z
          .string()
          .array()
          .parse(
            spawnSync("git", ["ls-files", "apps/*/project.json"], {
              encoding: "utf8",
            })
              .stdout.split("\n")
              .filter(Boolean),
          )
          .map((path) => JSON.parse(readFileSync(path, "utf8")))
          .filter((declared) => declared.metadata?.federation)
          .map((declared) => [
            declared.name,
            declared.metadata.federation.alias,
          ]),
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
