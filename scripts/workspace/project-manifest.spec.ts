import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
 *
 * Nothing this file reads is its own: it comes from git, from a subprocess, or
 * off disk. So each of those arrives through the narrowing helpers below, and
 * every diagnostic they raise names the workspace edit that clears it — a bare
 * `git`, `nx`, Node or Zod message names none.
 */

const workspaceDirectory = z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/);
const projectName = z.string().regex(/^[a-z][a-z0-9-]*$/);

/**
 * The path grammar git is held to. `git ls-files` quotes any path carrying a
 * character outside this set, so a name that would otherwise reach the
 * filesystem as something other than the file git meant is rejected first.
 */
const workspacePath = z.string().regex(/^[\w.-]+(?:\/[\w.-]+)*$/);

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
  exports: z
    .record(
      z.string(),
      z
        .string()
        .regex(/^\.\/[\w.-]+(?:\/[\w.-]+)*$/)
        .refine((target) => !target.split("/").includes("..")),
    )
    .optional(),
  dependencies: z.record(z.string(), z.literal("workspace:*")).optional(),
});

function fail(problem: string, remedy: string): never {
  throw new Error(`${problem}. ${remedy}`);
}

const detailOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function narrowed<T>(
  schema: z.ZodType<T>,
  value: unknown,
  subject: string,
  remedy: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    fail(
      `${subject} is not the shape this contract reads: ${parsed.error.issues
        .map(
          (issue) => `${issue.path.join(".") || "document"} ${issue.message}`,
        )
        .join("; ")}`,
      remedy,
    );
  return parsed.data;
}

function stdoutOf(
  subject: string,
  command: string,
  argv: string[],
  remedy: string,
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): string {
  const run = spawnSync(command, argv, {
    ...options,
    encoding: "utf8" as const,
  });
  if (run.error)
    fail(`${subject} could not be run: ${detailOf(run.error)}`, remedy);
  if (run.status !== 0)
    fail(
      `${subject} exited ${run.status ?? "on a signal"}: ${(run.stderr || run.stdout || "").trim()}`,
      remedy,
    );
  return run.stdout;
}

function contentsOf(path: string, remedy: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    fail(`${path} could not be read: ${detailOf(error)}`, remedy);
  }
}

function documentOf(path: string, remedy: string): unknown {
  const text = contentsOf(path, remedy);
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${path} is not valid JSON: ${detailOf(error)}`, remedy);
  }
}

const manifestRemedy =
  "Give it the manifest an @site package publishes — a private ESM package.json whose exports name files inside its own tree — then rerun just check.";

type Project = {
  name: string;
  root: string;
  manifest: z.infer<typeof manifestSchema> | undefined;
};

type ImportSite = { file: string; specifier: string };

let projects: Project[] = [];
let sites: ImportSite[] = [];

const moduleExtension = /\.(?:tsx?|mjs|js)$/;

/**
 * Every module git tracks under the three project trees. What git prints is a
 * list of names rather than a list of readable files — a path stays tracked
 * after it leaves the working tree — so both are settled here and nothing below
 * reaches the filesystem with a name git did not literally mean.
 */
function trackedModules(): string[] {
  const printed = stdoutOf(
    "git ls-files",
    "git",
    ["ls-files", "apps", "libs", "scripts"],
    "Run just check from inside this workspace's git checkout, with git on PATH.",
  );
  const listed = printed.split("\n").filter(Boolean);
  const quoted = listed.filter(
    (file) => !workspacePath.safeParse(file).success,
  );
  if (quoted.length > 0)
    fail(
      `git ls-files printed ${quoted.join(", ")}, which git quotes rather than names, so nothing here could open them`,
      "Rename those paths to word characters, dots and dashes, then rerun just check.",
    );
  const modules = listed.filter((file) => moduleExtension.test(file));
  const absent = modules.filter((file) => !existsSync(file));
  if (absent.length > 0)
    fail(
      `git tracks ${absent.join(", ")}, which the working tree does not hold`,
      "Restore those files or commit their removal, then rerun just check.",
    );
  return modules;
}

/**
 * The two specifier forms this contract reasons about. Everything else a module
 * writes — a Node builtin, a third-party package — is none of its business, so
 * it is read and ignored rather than held to a grammar it never had.
 */
const sitePackageImport = /^(@site\/[a-z][a-z0-9-]*)((?:\/[\w.-]+)*)$/;
const relativeImport = /^\.{1,2}(?:\/[\w.-]+)*$/;

/**
 * What one module imports, read with TypeScript's own scanner — so a specifier
 * written inside a template literal, which module-boundaries.spec.ts does to
 * hand eslint source to judge, is read as the string it is rather than as an
 * import this workspace makes. That also means the scanner hands back arbitrary
 * text, so a specifier claiming one of the two forms below without matching it
 * is refused here: it names a file the checks below would go looking for.
 */
function importedSpecifiers(file: string): string[] {
  const source = contentsOf(
    file,
    "Restore that file or make it readable, then rerun just check.",
  );
  return ts
    .preProcessFile(source, true, true)
    .importedFiles.map(({ fileName }) => {
      if (fileName.startsWith("@site/") && !sitePackageImport.test(fileName))
        fail(
          `${file} imports ${fileName}, which is not an @site package and subpath`,
          "Import @site/<project> or @site/<project>/<file>, then rerun just check.",
        );
      if (fileName.startsWith(".") && !relativeImport.test(fileName))
        fail(
          `${file} imports ${fileName}, which is not a relative path this contract can resolve`,
          "Write it as a literal relative path, or import the package that publishes it, then rerun just check.",
        );
      return fileName;
    });
}

/**
 * The `@site` package a specifier names, and the subpath it asks that package
 * for, keyed the way an `exports` map keys it.
 */
function siteImport(
  specifier: string,
): { name: string; subpath: string } | undefined {
  const [, name, subpath] = sitePackageImport.exec(specifier) ?? [];
  return name === undefined
    ? undefined
    : { name, subpath: `.${subpath ?? ""}` };
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
  const graphRemedy =
    "Fix what nx reports — a project.json it cannot read is the usual cause — then rerun just check.";
  stdoutOf(
    "pnpm exec nx graph",
    "pnpm",
    ["exec", "nx", "graph", `--file=${graphFile}`],
    graphRemedy,
    // llmlint: ignore[boundary_inputs_validated] The ambient environment is forwarded rather than narrowed, and that is the point: the graph this contract reads has to be the graph just check builds, and the justfile exports NX_CACHE_DIRECTORY into that environment, so an allowlist would build the graph under different cache settings than the workspace itself uses and would silently drift every time nx or pnpm started reading another variable. Nothing here reads the environment back — only nx receives it, and its one value this spec decides, NX_DAEMON, is written literally. Everything nx then hands back does get narrowed, by graphSchema below.
    { env: { ...process.env, NX_DAEMON: "false" } },
  );
  if (!existsSync(graphFile))
    fail(
      `pnpm exec nx graph wrote no project graph to ${graphFile}`,
      graphRemedy,
    );
  const graph = narrowed(
    graphSchema,
    documentOf(graphFile, graphRemedy),
    "the project graph nx wrote",
    graphRemedy,
  );
  projects = Object.entries(graph.graph.nodes).map(([name, node]) => {
    const path = join(node.data.root, "package.json");
    if (!existsSync(path))
      return { name, root: node.data.root, manifest: undefined };
    return {
      name,
      root: node.data.root,
      manifest: narrowed(
        manifestSchema,
        documentOf(path, manifestRemedy),
        path,
        manifestRemedy,
      ),
    };
  });
  sites = trackedModules().flatMap((file) =>
    importedSpecifiers(file).map((specifier) => ({ file, specifier })),
  );
});

describe("every project declares itself", () => {
  it("gives every project a manifest naming it @site/<project>", () => {
    expect(
      projects.length,
      "nx graph reported no projects, so nothing below was checked; rerun just check once nx can build this workspace's project graph",
    ).toBeGreaterThan(0);
    const findings = projects
      .filter((project) => project.manifest?.name !== `@site/${project.name}`)
      .map(
        (project) =>
          `${project.root}/package.json is missing or does not name the project @site/${project.name}, so ${project.name} resolves only through tsconfig.base.json paths; add a private ESM manifest there naming it @site/${project.name}`,
      );
    expect(findings).toEqual([]);
  });

  it("keeps every project root inside the pnpm workspace", () => {
    const globs = contentsOf(
      "pnpm-workspace.yaml",
      "Restore it from git, then rerun just check.",
    )
      .split("\n")
      .flatMap((line) => /^\s+-\s+(\S+\/\*)$/.exec(line)?.[1] ?? []);
    expect(
      globs.length,
      "pnpm-workspace.yaml declares no <directory>/* packages glob, so pnpm links nothing; give it one glob per project tree and run just bootstrap",
    ).toBeGreaterThan(0);
    // A manifest outside every workspace glob is a package pnpm never links,
    // so nothing it declares is resolvable however well-formed it reads.
    const outside = projects
      .filter((project) => !globs.includes(`${dirname(project.root)}/*`))
      .map(
        (project) =>
          `${project.root} is not covered by pnpm-workspace.yaml, so pnpm links none of the packages it depends on; add ${dirname(project.root)}/* to its packages list and run just bootstrap`,
      );
    expect(outside).toEqual([]);
  });

  it("declares every @site package a project imports, and no other", () => {
    const findings = projects.flatMap((project) => {
      const imported = new Set(
        sites
          .filter((site) => projectOf(site.file)?.name === project.name)
          .flatMap((site) => siteImport(site.specifier)?.name ?? [])
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
              `${project.root}/package.json imports ${name} but does not depend on it, so pnpm links nothing for it; add "${name}": "workspace:*" to its dependencies and run just bootstrap`,
          ),
        ...[...declared]
          .filter((name) => !imported.has(name))
          .map(
            (name) =>
              `${project.root}/package.json depends on ${name} but imports nothing from it; drop that dependency`,
          ),
      ];
    });
    expect(findings).toEqual([]);
  });
});

describe("every library publishes what its consumers import", () => {
  it("exposes every imported subpath as a subpath export", () => {
    const subpaths = sites.flatMap((site) => {
      const imported = siteImport(site.specifier);
      return imported && imported.subpath !== "." ? [{ site, imported }] : [];
    });
    expect(
      subpaths.length,
      "no module in this workspace imports an @site subpath, so no subpath export was checked; confirm git ls-files still lists the modules this contract scans",
    ).toBeGreaterThan(0);
    const findings = subpaths.flatMap(({ site, imported }) => {
      const owner = projects.find(
        (project) => project.manifest?.name === imported.name,
      );
      if (!owner)
        return [
          `${site.file} imports ${site.specifier}, which no project publishes; import a package some manifest names, or add a manifest naming ${imported.name} to the project that owns it`,
        ];
      return owner.manifest?.exports?.[imported.subpath]
        ? []
        : [
            `${owner.root}/package.json does not export ${imported.subpath}, which ${site.file} imports; add "${imported.subpath}" to its exports map, pointing at the file in ${owner.root} that publishes it`,
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
    expect(
      exported.length,
      "no project manifest declares an exports map, so no export target was checked; confirm nx graph still reports this workspace's libraries",
    ).toBeGreaterThan(0);
    const findings = exported
      .filter(({ project, target }) => !existsSync(join(project.root, target)))
      .map(
        ({ project, subpath, target }) =>
          `${project.root}/package.json exports ${subpath} as ${target}, which does not exist; point it at a file in ${project.root} or drop the entry`,
      );
    expect(findings).toEqual([]);
  });

  it("lets no project reach into a library by a relative path", () => {
    // A relative path into another library resolves for whoever wrote it and
    // for nobody else: it names a file rather than the surface that library
    // publishes, and it is invisible to every consumer's manifest.
    const findings = sites
      .filter((site) => relativeImport.test(site.specifier))
      .map((site) => ({
        site,
        target: join(dirname(site.file), site.specifier),
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
 *
 * The probe prints one line per specifier it could not resolve, and that line
 * is the only thing read back out of it — folded onto one line by the probe and
 * matched here, so an unresolved specifier is told apart from a probe that
 * printed something else entirely.
 */
const probeSource = [
  "for (const specifier of process.argv.slice(1))",
  "  try { import.meta.resolve(specifier) }",
  '  catch (error) { console.log(specifier + " :: " + error.message.replaceAll("\\n", " ")) }',
].join("\n");

const probeLine = /^(@site\/[a-z][a-z0-9-]*(?:\/[\w.-]+)*) :: (.+)$/;

function unresolvedSpecifiersIn(
  directory: string,
  specifiers: string[],
): { specifier: string; reason: string }[] {
  const subject = `the Node resolution probe in ${directory}`;
  const printed = stdoutOf(
    subject,
    "node",
    ["--input-type=module", "-e", probeSource, ...specifiers],
    `Check that node runs and that ${directory} is still a directory, then rerun just check.`,
    { cwd: directory },
  );
  return printed
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [, specifier, reason] = probeLine.exec(line) ?? [];
      if (specifier === undefined || reason === undefined)
        fail(
          `${subject} printed ${JSON.stringify(line)}, which is not the "<specifier> :: <reason>" line it is written to print`,
          "Make probeSource in this file and the line read back from it agree again, then rerun just check.",
        );
      return { specifier, reason };
    });
}

describe("Node resolves what every import site writes", () => {
  it("resolves every @site specifier from the directory that imports it", () => {
    const byDirectory = new Map<string, Set<string>>();
    for (const site of sites) {
      if (!siteImport(site.specifier)) continue;
      const directory = dirname(site.file);
      byDirectory.set(
        directory,
        (byDirectory.get(directory) ?? new Set()).add(site.specifier),
      );
    }
    expect(
      byDirectory.size,
      "no directory in this workspace imports an @site package, so no Node resolution was probed; confirm git ls-files still lists the modules this contract scans",
    ).toBeGreaterThan(0);
    const findings = [...byDirectory].flatMap(([directory, specifiers]) =>
      unresolvedSpecifiersIn(directory, [...specifiers]).map(
        ({ specifier, reason }) =>
          `${directory} imports ${specifier}, which Node cannot resolve from there: ${reason}; declare that subpath in the exports map of the package that owns it and run just bootstrap so pnpm links it`,
      ),
    );
    expect(findings).toEqual([]);
  }, 120_000);
});
