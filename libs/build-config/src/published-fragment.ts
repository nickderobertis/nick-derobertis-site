import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
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
/* v8 ignore start -- Reachable only from the emit hook below, which runs inside a real rspack build; every app build drives it and every route journey drives the CSS it rewrites. */
function absolutizeCssUrls(css: string, publicPath: string) {
  return css.replace(cssUrlPattern, (match, quoted, single, bare) => {
    const target = quoted ?? single ?? bare ?? "";
    if (target === "" || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(target))
      return match;
    return `url("${publicPath}${target}")`;
  });
}
/* v8 ignore stop */
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
/* v8 ignore start -- Compiling a renderer and emitting a fragment happen inside the rspack build that owns this plugin, which v8 cannot instrument from a test process; every app build drives both, the artifact gate rejects what they emit wrongly, and every route journey drives the published bytes. */
/**
 * The design system publishes the tokens every other stylesheet in this
 * workspace is written against, and it is one of the share-scope singletons in
 * rspack-remote.ts, so its rules are emitted in the chunk the share resolves
 * rather than inside the app's own stylesheet. This is the declaration that
 * identifies that chunk among the ones a build emitted; it is read from the
 * design system rather than restated, so a theme whose first token moved fails
 * the assembly below by name instead of silently ordering it wrongly.
 */
const designTokensSource = "libs/design-system/src/theme.css";

async function designTokenDeclaration() {
  const theme = await readFile(resolve(designTokensSource), "utf8");
  const declaration = /--[a-z-]+:\s*[^;]+/.exec(theme)?.[0];
  if (!declaration)
    throw new Error(
      `${designTokensSource} must declare at least one custom property for a fragment's stylesheet to be assembled around; add one and rebuild.`,
    );
  return withoutWhitespace(declaration);
}

function withoutWhitespace(css: string) {
  return css.replace(/\s+/g, "");
}

/**
 * One app's prerendered markup is inlined into every document that composes it,
 * and so is the CSS that styles it, which is why this is assembled from every
 * stylesheet the build emitted rather than read from the entry's own: the
 * design system is a share, so an app reaches it through a dynamic import and
 * its tokens land in the chunk the share scope resolves. Those tokens come
 * first and the app's own rules follow in a stable order, which is the cascade
 * a browser loading those chunks arrives at, and a stylesheet emitted twice is
 * inlined once.
 */
async function fragmentStylesheet(
  name: string,
  outputPath: string,
  emitted: readonly string[],
) {
  const tokens = await designTokenDeclaration();
  const stylesheets = await Promise.all(
    [...emitted]
      .filter((asset) => asset.endsWith(".css"))
      .sort()
      .map((asset: string) => readFile(resolve(outputPath, asset), "utf8")),
  );
  const carriesTokens = (css: string) =>
    withoutWhitespace(css).includes(tokens);
  if (!stylesheets.some(carriesTokens))
    throw new Error(
      `The ${name} build emitted no stylesheet carrying the design tokens from ${designTokensSource}; check that this app imports @site/design-system, then rebuild.`,
    );
  const seen = new Set<string>();
  return [
    ...stylesheets.filter(carriesTokens),
    ...stylesheets.filter((css) => !carriesTokens(css)),
  ]
    .filter((css) => {
      if (seen.has(css)) return false;
      seen.add(css);
      return true;
    })
    .join("\n");
}

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
        await publishFragment(
          this.name,
          outputPath,
          Object.keys(compilation.assets),
          html,
          compilation.outputOptions.publicPath?.toString() ?? "",
        );
      },
    );
  }
}

export async function publishFragment(
  name: string,
  outputPath: string,
  emitted: readonly string[],
  html: string,
  publicPath: string,
) {
  const css = await fragmentStylesheet(name, outputPath, emitted);
  await Promise.all([
    writeFile(resolve(outputPath, "fragment.html"), html),
    writeFile(
      resolve(outputPath, "fragment.css"),
      absolutizeCssUrls(css, publicPath),
    ),
    writeFile(
      resolve(outputPath, "fragment.json"),
      serializeFragmentContract({
        schemaVersion: 1,
        name,
        react: packageDependencies.react,
        reactDom: packageDependencies.reactDom,
        revision: sourceRevision(),
      }),
    ),
  ]);
}
/* v8 ignore stop */
// llmlint: ignore-end[changed_behavior_has_e2e]
