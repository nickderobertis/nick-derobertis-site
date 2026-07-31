import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { type Compiler, rspack } from "@rspack/core";
import { serializeFragmentContract } from "./fragment-contract";

const unvalidatedPackageManifest: unknown = createRequire(import.meta.url)(
  "../../../package.json",
);
if (
  !unvalidatedPackageManifest ||
  typeof unvalidatedPackageManifest !== "object" ||
  !("dependencies" in unvalidatedPackageManifest) ||
  !unvalidatedPackageManifest.dependencies ||
  typeof unvalidatedPackageManifest.dependencies !== "object" ||
  !("react" in unvalidatedPackageManifest.dependencies) ||
  typeof unvalidatedPackageManifest.dependencies.react !== "string" ||
  !("react-dom" in unvalidatedPackageManifest.dependencies) ||
  typeof unvalidatedPackageManifest.dependencies["react-dom"] !== "string"
)
  throw new Error(
    "package.json must declare string react and react-dom dependencies before fragments can be published.",
  );
const packageManifest = unvalidatedPackageManifest as {
  dependencies: { react: string; "react-dom": string };
};
const cssUrlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)/g;

function absolutizeCssUrls(css: string, publicPath: string) {
  return css.replace(cssUrlPattern, (match, quoted, single, bare) => {
    const target = quoted ?? single ?? bare ?? "";
    if (target === "" || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(target))
      return match;
    return `url("${publicPath}${target}")`;
  });
}

const unavailableSourceRevision = "0000000";

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

function compileRenderer(name: string, outputPath: string) {
  return new Promise<void>((resolveCompilation, rejectCompilation) => {
    const compiler = rspack({
      mode: "production",
      target: "node",
      entry: resolve(
        name === "shell"
          ? "scripts/shell-fragment-entry.tsx"
          : "scripts/remote-fragment-entry.tsx",
      ),
      output: {
        path: resolve(outputPath),
        filename: "render.cjs",
        library: { type: "commonjs2" },
        clean: true,
      },
      resolve: {
        alias:
          name === "shell"
            ? {}
            : {
                "@site-fragment/page": resolve(
                  name === "home"
                    ? "scripts/home-fragment-page.tsx"
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
      compiler.close(() => undefined);
      if (error) rejectCompilation(error);
      else if (!stats || stats.hasErrors())
        rejectCompilation(
          new Error(stats?.toString({ colors: false }) ?? "No build stats"),
        );
      else resolveCompilation();
    });
  });
}

// llmlint: ignore-block[changed_behavior_has_e2e] Publication is a build/filesystem boundary with no browser interface; site.spec.ts and preload.spec.ts drive these exact published bytes through the assembled artifact with JavaScript disabled and through hydration, while remote-owner.spec.ts drives every published remote through both standalone and host-composed boundaries.
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
        const renderer = require(resolve(rendererPath, "render.cjs")) as {
          renderFragment?: () => Promise<string>;
          renderShellFragment?: () => Promise<string>;
        };
        const render =
          this.name === "shell"
            ? renderer.renderShellFragment
            : renderer.renderFragment;
        if (typeof render !== "function")
          throw new Error(`The ${this.name} fragment renderer is invalid`);
        const html = await render();
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
              react: packageManifest.dependencies.react,
              reactDom: packageManifest.dependencies["react-dom"],
              revision: sourceRevision(),
            }),
          ),
        ]);
      },
    );
  }
}
// llmlint: ignore-end[changed_behavior_has_e2e]
