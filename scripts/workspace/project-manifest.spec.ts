import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize } from "node:path";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * What a project is allowed to know about itself.
 *
 * Cross-project resolution used to run entirely through `tsconfig.base.json`
 * `paths`: one entry per library, in a file `sharedGlobals` puts in every
 * cached target's key, so adding one library reran every project in the
 * workspace. A manifest per project moves that declaration into the project,
 * and the mechanism only pays off while every project actually carries one — a
 * project added tomorrow with no `package.json` silently falls back to `paths`
 * and nothing else notices, because `paths` still resolves it.
 *
 * So the subjects here come from the real Nx project graph rather than a list
 * kept in this file, and every claim is made against the resolver that has to
 * agree: what a project imports is read with TypeScript's own scanner, and each
 * specifier is then resolved by a real Node ESM resolution from the directory
 * that imports it. Node is the strict one — the CLIs under `scripts/` and the
 * capture entries under `apps/` are type-stripped and executed directly, with
 * no bundler and no tsconfig alias in reach — so a subpath that satisfies tsc
 * and Vite while Node rejects it fails here.
 */

const workspaceDirectory = z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/);
const projectName = z.string().regex(/^[a-z][a-z0-9-]*$/);

const graphSchema = z.object({
  graph: z.object({
    nodes: z.record(
      projectName,
      z.object({ data: z.object({ root: workspaceDirectory }) }),
    ),
  }),
});

/**
 * The manifest shape the workspace publishes: private, ESM, and — for a
 * library, the only kind of project anything imports — an `exports` map whose
 * every target is a real file in that library's own tree.
 */
const manifestSchema = z.object({
  name: z.string().regex(/^@site\/[a-z][a-z0-9-]*$/),
  private: z.literal(true),
  type: z.literal("module"),
  exports: z.record(z.string(), z.string()).optional(),
  dependencies: z.record(z.string(), z.literal("workspace:*")).optional(),
});

type Project = {
  name: string;
  root: string;
  manifest: z.infer<typeof manifestSchema> | undefined;
};

/** One import site: the file that wrote the specifier, and the specifier. */
type ImportSite = { file: string; specifier: string };

let projects: Project[] = [];
let sites: ImportSite[] = [];

/** Every tracked module in the workspace that can carry an import. */
function trackedModules(): string[] {
  return execFileSync("git", ["ls-files", "apps", "libs", "scripts"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => /\.(?:tsx?|mjs|js)$/.test(file));
}

const projectOf = (file: string) =>
  projects.find(
    (project) => file === project.root || file.startsWith(`${project.root}/`),
  );

beforeAll(() => {
  const graphFile = join(
    mkdtempSync(join(tmpdir(), "project-manifest-")),
    "graph.json",
  );
  execFileSync("pnpm", ["exec", "nx", "graph", `--file=${graphFile}`], {
    encoding: "utf8",
    env: { ...process.env, NX_DAEMON: "false" },
    stdio: "pipe",
  });
  const graph = graphSchema.parse(JSON.parse(readFileSync(graphFile, "utf8")));
  projects = Object.entries(graph.graph.nodes).map(([name, node]) => {
    const path = join(node.data.root, "package.json");
    if (!existsSync(path))
      return { name, root: node.data.root, manifest: undefined };
    // A manifest this cannot read is the finding, and naming the file is what
    // makes it one: every claim below reads a project's declaration out of it.
    const parsed = manifestSchema.safeParse(
      JSON.parse(readFileSync(path, "utf8")),
    );
    if (!parsed.success)
      throw new Error(
        `${path} is not a workspace manifest: ${parsed.error.message}`,
      );
    return { name, root: node.data.root, manifest: parsed.data };
  });
  // TypeScript's own scanner, so a specifier written inside a template literal
  // — which module-boundaries.spec.ts does, to hand eslint source to judge — is
  // read as the string it is rather than as an import this workspace makes.
  sites = trackedModules().flatMap((file) =>
    ts
      .preProcessFile(readFileSync(file, "utf8"), true, true)
      .importedFiles.map(({ fileName }) => ({ file, specifier: fileName })),
  );
});

/** The `@site/…` package a specifier names, or undefined for anything else. */
function packageOf(specifier: string): string | undefined {
  const [scope, name] = specifier.split("/");
  return scope === "@site" && name ? `@site/${name}` : undefined;
}

describe("every project declares itself", () => {
  it("gives every project a manifest naming it @site/<project>", () => {
    expect(projects.length).toBeGreaterThan(0);
    const findings = projects
      .filter((project) => project.manifest?.name !== `@site/${project.name}`)
      .map(
        (project) =>
          `${project.root}/package.json is missing or does not name the project @site/${project.name}, so ${project.name} resolves only through tsconfig.base.json paths`,
      );
    expect(findings).toEqual([]);
  });

  it("keeps every project root inside the pnpm workspace", () => {
    const globs = readFileSync("pnpm-workspace.yaml", "utf8")
      .split("\n")
      .flatMap((line) => /^\s+-\s+(\S+\/\*)$/.exec(line)?.[1] ?? []);
    expect(globs.length).toBeGreaterThan(0);
    // A manifest outside every workspace glob is a package pnpm never links,
    // so nothing it declares is resolvable however well-formed it reads.
    const outside = projects
      .filter((project) => !globs.includes(`${dirname(project.root)}/*`))
      .map(
        (project) =>
          `${project.root} is not covered by pnpm-workspace.yaml, so pnpm links none of the packages it depends on`,
      );
    expect(outside).toEqual([]);
  });

  it("declares every @site package a project imports, and no other", () => {
    const findings = projects.flatMap((project) => {
      const imported = new Set(
        sites
          .filter((site) => projectOf(site.file)?.name === project.name)
          .flatMap((site) => packageOf(site.specifier) ?? [])
          .filter((name) => name !== `@site/${project.name}`),
      );
      const declared = new Set(
        Object.keys(project.manifest?.dependencies ?? {}),
      );
      return [
        ...[...imported]
          .filter((name) => !declared.has(name))
          .map(
            (name) =>
              `${project.root}/package.json imports ${name} but does not depend on it, so pnpm links nothing for it`,
          ),
        ...[...declared]
          .filter((name) => !imported.has(name))
          .map(
            (name) =>
              `${project.root}/package.json depends on ${name} but imports nothing from it`,
          ),
      ];
    });
    expect(findings).toEqual([]);
  });
});

describe("every library publishes what its consumers import", () => {
  it("exposes every imported subpath as a subpath export", () => {
    const subpaths = sites.filter(
      (site) =>
        (packageOf(site.specifier) ?? site.specifier) !== site.specifier,
    );
    expect(subpaths.length).toBeGreaterThan(0);
    const findings = subpaths.flatMap((site) => {
      const name = packageOf(site.specifier);
      const owner = projects.find((project) => project.manifest?.name === name);
      if (!owner)
        return [
          `${site.file} imports ${site.specifier}, which no project publishes`,
        ];
      const subpath = `.${site.specifier.slice(name?.length ?? 0)}`;
      return owner.manifest?.exports?.[subpath]
        ? []
        : [
            `${owner.root}/package.json does not export ${subpath}, which ${site.file} imports`,
          ];
    });
    expect(findings).toEqual([]);
  });

  it("points every export at a file in its own tree", () => {
    const exported = projects.flatMap((project) =>
      Object.entries(project.manifest?.exports ?? {}).map(
        ([subpath, target]) => ({ project, subpath, target }),
      ),
    );
    expect(exported.length).toBeGreaterThan(0);
    const findings = exported
      .filter(({ project, target }) => !existsSync(join(project.root, target)))
      .map(
        ({ project, subpath, target }) =>
          `${project.root}/package.json exports ${subpath} as ${target}, which does not exist`,
      );
    expect(findings).toEqual([]);
  });

  it("lets no project reach into a library by a relative path", () => {
    // A relative path into another library resolves for whoever wrote it and
    // for nobody else: it names a file rather than the surface that library
    // publishes, and it is invisible to every consumer's manifest.
    const findings = sites
      .filter((site) => site.specifier.startsWith("."))
      .map((site) => ({
        site,
        target: normalize(join(dirname(site.file), site.specifier)),
      }))
      .filter(
        ({ site, target }) =>
          target.startsWith("libs/") &&
          !target.startsWith(`${projectOf(site.file)?.root}/`),
      )
      .map(
        ({ site, target }) =>
          `${site.file} imports ${target} by a relative path that leaves its own project; import the package that publishes it instead`,
      );
    expect(findings).toEqual([]);
  });
});

/**
 * Node resolution is the binding one. The `scripts/` CLIs and the `apps/`
 * capture entries are type-stripped and run by Node directly, with no bundler
 * and no tsconfig alias, so this resolves each specifier the way those
 * processes do: `import.meta.resolve`, from the directory that imports it.
 * Grouped per directory so one Node process answers for every specifier
 * written there.
 */
const probeSource = [
  "for (const specifier of process.argv.slice(1))",
  "  try { import.meta.resolve(specifier) }",
  '  catch (error) { console.log(specifier + ": " + error.message) }',
].join("\n");

function resolvedFrom(directory: string, specifiers: string[]): string[] {
  const probe = spawnSync(
    "node",
    ["--input-type=module", "-e", probeSource, ...specifiers],
    { cwd: directory, encoding: "utf8" },
  );
  if (probe.status !== 0)
    throw new Error(
      `could not probe Node resolution in ${directory}: ${probe.stdout ?? ""}${probe.stderr ?? ""}`,
    );
  return (probe.stdout ?? "").split("\n").filter(Boolean);
}

describe("Node resolves what every import site writes", () => {
  it("resolves every @site specifier from the directory that imports it", () => {
    const byDirectory = new Map<string, Set<string>>();
    for (const site of sites) {
      if (!packageOf(site.specifier)) continue;
      const directory = dirname(site.file);
      byDirectory.set(
        directory,
        (byDirectory.get(directory) ?? new Set()).add(site.specifier),
      );
    }
    expect(byDirectory.size).toBeGreaterThan(0);
    const findings = [...byDirectory].flatMap(([directory, specifiers]) =>
      resolvedFrom(directory, [...specifiers]).map(
        (failure) => `${directory}: ${failure}`,
      ),
    );
    expect(findings).toEqual([]);
  }, 120_000);
});
