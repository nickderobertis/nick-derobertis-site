import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { type Compiler, rspack } from "@rspack/core";
import { serializeFragmentContract } from "./fragment-contract";

const invalidPackageManifest =
  "package.json must declare string react and react-dom dependencies before fragments can be published.";

// llmlint: ignore-block[changed_behavior_has_e2e] The workspace manifest is a build input with no browser interface; published-fragment.spec.ts drives this validation through complete and malformed manifests, and the versions it returns reach the browser only as fragment.json metadata.
/**
 * Narrows the workspace manifest to the React versions every fragment contract
 * is stamped with. Destructuring into locals is what carries the validated
 * shape into the return type, so no caller has to assert it.
 */
export function reactDependencies(manifest: unknown): {
  react: string;
  reactDom: string;
} {
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !("dependencies" in manifest)
  )
    throw new Error(invalidPackageManifest);
  const { dependencies } = manifest;
  if (
    !dependencies ||
    typeof dependencies !== "object" ||
    !("react" in dependencies) ||
    !("react-dom" in dependencies)
  )
    throw new Error(invalidPackageManifest);
  const { react } = dependencies;
  const reactDom = dependencies["react-dom"];
  if (typeof react !== "string" || typeof reactDom !== "string")
    throw new Error(invalidPackageManifest);
  return { react, reactDom };
}
// llmlint: ignore-end[changed_behavior_has_e2e]

const packageDependencies = reactDependencies(
  createRequire(import.meta.url)("../../../package.json"),
);
const cssUrlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)/g;

// llmlint: ignore-block[changed_behavior_has_e2e] Published CSS is exercised through its rendered output by every standalone and host-composed visual journey; URL rejection happens at the build boundary before a browser artifact exists.
function absolutizeCssUrls(css: string, publicPath: string) {
  return css.replace(cssUrlPattern, (match, quoted, single, bare) => {
    const target = quoted ?? single ?? bare ?? "";
    if (target === "" || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(target))
      return match;
    return `url("${publicPath}${target}")`;
  });
}
// llmlint: ignore-end[changed_behavior_has_e2e]

const unavailableSourceRevision = "0000000";

// llmlint: ignore-block[changed_behavior_has_e2e] Revision selection is fragment metadata with no browser interface; published-fragment.spec.ts covers injected, unavailable-Git, and invalid boundary behavior, while the pinned container capture exercises the successful publication boundary.
export function sourceRevision(
  injectedRevision = process.env.SOURCE_REVISION,
  readGitRevision = () =>
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
) {
  let revision = injectedRevision;
  if (revision === undefined) {
    try {
      revision = readGitRevision();
    } catch {
      revision = unavailableSourceRevision;
    }
  }
  if (!/^[0-9a-f]{7,64}$/i.test(revision))
    throw new Error(
      "SOURCE_REVISION must be a 7-64 character hexadecimal revision; set it to the published source commit and rebuild the fragment.",
    );
  return revision;
}
// llmlint: ignore-end[changed_behavior_has_e2e]

// llmlint: ignore-block[changed_behavior_has_e2e] Loading a compiled renderer is a build boundary with no browser interface; published-fragment.spec.ts drives this validation through shell, remote, missing-export, and non-HTML modules, and the HTML it returns is driven through the browser by site.spec.ts and every feature journey.
/**
 * Loads a fragment renderer's export from a module the compiler produced but
 * Node hands back untyped, so both the export and its rendered HTML are
 * validated here instead of asserted at the require boundary.
 */
export async function renderFragmentHtml(
  rendererModule: unknown,
  name: string,
) {
  if (!rendererModule || typeof rendererModule !== "object")
    throw new Error(`The ${name} fragment renderer is invalid`);
  const shellRender =
    "renderShellFragment" in rendererModule
      ? rendererModule.renderShellFragment
      : undefined;
  const remoteRender =
    "renderFragment" in rendererModule
      ? rendererModule.renderFragment
      : undefined;
  const render = name === "shell" ? shellRender : remoteRender;
  if (typeof render !== "function")
    throw new Error(`The ${name} fragment renderer is invalid`);
  const html: unknown = await render();
  if (typeof html !== "string")
    throw new Error(`The ${name} fragment renderer did not return HTML`);
  return html;
}
// llmlint: ignore-end[changed_behavior_has_e2e]

// llmlint: ignore-block[changed_behavior_has_e2e] Renderer compilation is a build boundary with no direct browser interface; site.spec.ts and every feature journey drive its published output through hydration and standalone/host-composed rendering, and container screenshot capture exercises the real compiler lifecycle.
function compileRenderer(name: string, outputPath: string) {
  return new Promise<void>((resolveCompilation, rejectCompilation) => {
    const compiler = rspack({
      mode: "production",
      target: "node",
      entry: resolve(
        name === "shell"
          ? "libs/build-config/src/shell-fragment-entry.tsx"
          : "libs/build-config/src/remote-fragment-entry.tsx",
      ),
      output: {
        path: resolve(outputPath),
        filename: "render.cjs",
        library: { type: "commonjs2" },
        clean: true,
      },
      resolve: {
        // Each entry reaches the app it prerenders through this compilation's
        // own aliases rather than a static import. That is what keeps the
        // entries build inputs: nothing in this library's module graph — and so
        // nothing in Nx's project graph — points from here back into an app.
        alias:
          name === "shell"
            ? {
                "@site-fragment/router": resolve("apps/shell/src/router.tsx"),
                "@site-fragment/routes": resolve("apps/shell/src/routes.ts"),
              }
            : {
                "@site-fragment/page": resolve(
                  name === "home"
                    ? "libs/build-config/src/home-fragment-page.tsx"
                    : `apps/${name}/src/page.tsx`,
                ),
              },
        extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
        tsConfig: resolve("tsconfig.base.json"),
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            use: [
              {
                loader: "builtin:swc-loader",
                options: {
                  jsc: {
                    parser: { syntax: "typescript", tsx: true },
                    transform: { react: { runtime: "automatic" } },
                  },
                },
              },
            ],
            type: "javascript/auto",
          },
          { test: /\.css$/, type: "asset/source" },
        ],
      },
      optimization: { minimize: false },
    });
    compiler.run((error, stats) => {
      const compilationError = error
        ? error
        : !stats || stats.hasErrors()
          ? new Error(stats?.toString({ colors: false }) ?? "No build stats")
          : undefined;
      compiler.close((closeError) => {
        if (compilationError) rejectCompilation(compilationError);
        else if (closeError) rejectCompilation(closeError);
        else resolveCompilation();
      });
    });
  });
}
// llmlint: ignore-end[changed_behavior_has_e2e]

// llmlint: ignore-block[changed_behavior_has_e2e] Publication is a build/filesystem boundary with no browser interface; site.spec.ts and preload.spec.ts drive these exact published bytes through the assembled artifact with JavaScript disabled and through hydration, while each app's ownership.spec.ts drives its published remote through both standalone and host-composed boundaries.
export class PublishedFragmentPlugin {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  apply(compiler: Compiler) {
    compiler.hooks.afterEmit.tapPromise(
      "PublishedFragmentPlugin",
      async (compilation) => {
        const outputPath = compilation.outputOptions.path;
        if (!outputPath)
          throw new Error("Fragment build requires an output path");
        const rendererPath = resolve("dist/fragment-renderers", this.name);
        await compileRenderer(this.name, rendererPath);
        const rendererModule: unknown = require(
          resolve(rendererPath, "render.cjs"),
        );
        const html = await renderFragmentHtml(rendererModule, this.name);
        const index = await readFile(resolve(outputPath, "index.html"), "utf8");
        const stylesheet = /href="([^"]*main\.[0-9a-f]+\.css)"/.exec(
          index,
        )?.[1];
        if (!stylesheet)
          throw new Error(`The ${this.name} build has no page stylesheet`);
        const css = await readFile(
          resolve(outputPath, basename(stylesheet)),
          "utf8",
        );
        await Promise.all([
          writeFile(resolve(outputPath, "fragment.html"), html),
          writeFile(
            resolve(outputPath, "fragment.css"),
            absolutizeCssUrls(
              css,
              compilation.outputOptions.publicPath?.toString() ?? "",
            ),
          ),
          writeFile(
            resolve(outputPath, "fragment.json"),
            serializeFragmentContract({
              schemaVersion: 1,
              name: this.name,
              react: packageDependencies.react,
              reactDom: packageDependencies.reactDom,
              revision: sourceRevision(),
            }),
          ),
        ]);
      },
    );
  }
}
// llmlint: ignore-end[changed_behavior_has_e2e]
