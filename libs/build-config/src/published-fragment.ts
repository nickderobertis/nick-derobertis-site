import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { type Compiler, rspack } from "@rspack/core";
import { serializeFragmentContract } from "./fragment-contract";

const packageManifest = createRequire(import.meta.url)(
  "../../../package.json",
) as typeof import("../../../package.json");
const cssUrlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)/g;

function absolutizeCssUrls(css: string, publicPath: string) {
  return css.replace(cssUrlPattern, (match, quoted, single, bare) => {
    const target = quoted ?? single ?? bare ?? "";
    if (target === "" || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(target))
      return match;
    return `url("${publicPath}${target}")`;
  });
}

function sourceRevision() {
  return (
    process.env.SOURCE_REVISION ??
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  );
}

function compileRenderer(name: string, outputPath: string) {
  return new Promise<void>((resolveCompilation, rejectCompilation) => {
    const compiler = rspack({
      mode: "production",
      target: "node",
      entry: resolve("scripts/remote-fragment-entry.tsx"),
      output: {
        path: resolve(outputPath),
        filename: "render.cjs",
        library: { type: "commonjs2" },
        clean: true,
      },
      resolve: {
        alias: {
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

export class PublishedFragmentPlugin {
  readonly name: string;
  readonly renderPage: boolean;

  constructor(name: string, renderPage = true) {
    this.name = name;
    this.renderPage = renderPage;
  }

  apply(compiler: Compiler) {
    compiler.hooks.afterEmit.tapPromise(
      "PublishedFragmentPlugin",
      async (compilation) => {
        const outputPath = compilation.outputOptions.path;
        if (!outputPath)
          throw new Error("Fragment build requires an output path");
        let html: string;
        if (this.renderPage) {
          const rendererPath = resolve("dist/fragment-renderers", this.name);
          await compileRenderer(this.name, rendererPath);
          const renderer = require(resolve(rendererPath, "render.cjs")) as {
            renderFragment?: () => Promise<string>;
          };
          if (typeof renderer.renderFragment !== "function")
            throw new Error(`The ${this.name} fragment renderer is invalid`);
          html = await renderer.renderFragment();
        } else {
          html = await readFile(resolve(outputPath, "index.html"), "utf8");
        }
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
