import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, relative, resolve } from "node:path";
import ts from "typescript";

// llmlint: ignore-file[changed_behavior_has_e2e] This module has no browser
// interface and nothing it returns reaches a visitor: it reads committed source
// with TypeScript's own scanner and Node's own resolver to say which CV data
// files a project's modules can reach at all. cv-data-reachability.spec.ts
// drives it over every feature that reads a CV domain and over the bundled
// client, whose seven files are what says the walk sees what is there.

/** Where this workspace vendors the generated CV data. */
export const cvDataDirectory = "libs/data-access-core/vendor/codegen";

/**
 * Every file under that directory carrying CV content: the aggregate and the
 * six domain slices cut from it. Derived from the tree rather than named here,
 * so a domain added by a later codegen run is a subject the day it lands.
 *
 * `cv.schema.json` is deliberately not one of these. It is the contract the
 * data is checked against rather than the data, it carries no CV content, and
 * every module that validates a fetched or committed slice reaches it — the
 * shell and the awards pane already did before any feature took a slice.
 */
export function cvPayloadFiles() {
  const domains = join(cvDataDirectory, "domains");
  return [
    join(cvDataDirectory, "cv.json"),
    ...readdirSync(domains)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => join(domains, entry)),
  ]
    .filter((file) => existsSync(file))
    .toSorted();
}

/** The extensions this workspace writes modules in. */
const moduleExtensions = new Set([".ts", ".tsx", ".mjs", ".js", ".jsx"]);

/**
 * A declaration file carries types and no runtime import, so it is resolved —
 * `../vendor/codegen` is the generated CV types, and every consumer names it —
 * and then read as a leaf rather than followed.
 */
const isDeclaration = (file) => file.endsWith(".d.ts");

/**
 * The files a relative specifier can name, in the order a bundler tries them.
 * Relative resolution is spelled out here because the specifiers this
 * workspace writes are extensionless — `./page`, `./domains/skills` — and
 * Node's own resolver answers those only for the extensions it executes.
 */
function resolveRelative(specifier, fromFile) {
  const base = resolve(dirname(fromFile), specifier);
  const extensions = [...moduleExtensions, ".d.ts"];
  const candidates = [
    base,
    ...extensions.map((extension) => `${base}${extension}`),
    ...extensions.map((extension) => join(base, `index${extension}`)),
  ];
  const found = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
  if (found === undefined)
    throw new Error(
      `${relative(process.cwd(), fromFile)} imports ${specifier}, which names no file beside it; fix that import, then rerun the tooling-artifact test target.`,
    );
  return found;
}

/**
 * What one specifier resolves to, or `undefined` when it names something
 * outside this workspace's own source.
 *
 * A `@site` package is resolved by Node itself, through the `exports` map that
 * package publishes — the same map the bundler and the test runner resolve it
 * through — so a subpath answered by the wrong file here is answered by the
 * wrong file there too. Everything else bare is a third-party package or a
 * federated remote (`home-cards/Page`), neither of which can carry this
 * repository's vendored CV data, so it is read and dropped.
 */
function resolveSpecifier(specifier, fromFile) {
  if (specifier.startsWith(".")) return resolveRelative(specifier, fromFile);
  if (!specifier.startsWith("@site/")) return undefined;
  try {
    return createRequire(fromFile).resolve(specifier);
  } catch (error) {
    throw new Error(
      `${relative(process.cwd(), fromFile)} imports ${specifier}, which no package publishes: ${error instanceof Error ? error.message : String(error)}. Publish that subpath or fix the import, then rerun the tooling-artifact test target.`,
    );
  }
}

/**
 * The specifiers one module imports at runtime, read off TypeScript's own
 * syntax tree.
 *
 * A type-only import or re-export is skipped, because the compiler erases it
 * and no byte of what it names reaches a bundle: `@site/data-access-core`'s
 * barrel re-exports the bundled client's *type*, and following that would
 * report the whole CV as reachable from every module that names a CV type.
 * Everything else is followed, including an import whose named bindings are
 * individually type-only, which is the conservative reading: counting a
 * specifier a bundler may elide can only overstate what an app can reach.
 */
function importedModuleSpecifiers(text, file) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    false,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = [];
  const literal = (node) =>
    node !== undefined && ts.isStringLiteralLike(node) ? node.text : undefined;
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      const named = literal(node.moduleSpecifier);
      if (named !== undefined) specifiers.push(named);
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
      const named = literal(node.moduleSpecifier);
      if (named !== undefined) specifiers.push(named);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const named = literal(node.arguments[0]);
      if (named !== undefined) specifiers.push(named);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return specifiers;
}

/**
 * Every file reachable from `entries` by following imports, and every CV
 * payload file among them.
 *
 * The imports are read off TypeScript's own syntax tree rather than matched out
 * of the text, so a static import, a re-export and a dynamic `import()` of a
 * string literal all count, a specifier written inside a string does not, and a
 * type-only import — which the compiler erases — is not followed.
 *
 * This is reachability through the module graph, which is what a bundle is
 * built from: a payload file this walk does not reach is one no chunk of that
 * app can hold, rather than one that happens not to appear in a sample of the
 * strings it emitted.
 */
export function cvDataReachableFrom(entries) {
  const payload = new Set(cvPayloadFiles().map((file) => resolve(file)));
  const reachedPayload = new Set();
  const visited = new Set();
  const queue = entries.map((entry) => resolve(entry));
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    if (visited.has(next)) continue;
    visited.add(next);
    if (payload.has(next)) reachedPayload.add(next);
    // Only a module is scanned. A JSON, CSS or image the graph reaches is a
    // leaf: it imports nothing, and whether it is CV payload was settled above.
    if (!moduleExtensions.has(extname(next)) || isDeclaration(next)) continue;
    for (const specifier of importedModuleSpecifiers(
      readFileSync(next, "utf8"),
      next,
    )) {
      const resolved = resolveSpecifier(specifier, next);
      if (resolved !== undefined) queue.push(resolved);
    }
  }
  return {
    files: [...visited].map((file) => relative(process.cwd(), file)).toSorted(),
    payloadFiles: [...reachedPayload]
      .map((file) => relative(process.cwd(), file))
      .toSorted(),
  };
}

/**
 * The modules an app's own build compiles: its source, minus the specs that
 * never reach a bundle.
 *
 * Every one of them is walked rather than only the two rspack names as
 * entries — `main.tsx` and the `./Page` expose — because the claim being made
 * is about what the app's output can hold at all. A superset of the entries
 * cannot understate what those entries reach, and it cannot go stale the day
 * an expose is added.
 */
export function appSourceModules(app) {
  const root = join("apps", app, "src");
  const walk = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walk(path);
      return moduleExtensions.has(extname(entry.name)) &&
        !/\.spec\.tsx?$/.test(entry.name)
        ? [path]
        : [];
    });
  return walk(root).toSorted();
}
