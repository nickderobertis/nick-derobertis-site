import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Compiler, Configuration } from "@rspack/core";
import { HtmlRspackPlugin } from "@rspack/core";
import { composedArtifactRoot } from "./composed-artifact";
import { PublishedFragmentPlugin } from "./published-fragment";

/** Where the app the server is building from source is mounted. */
export interface ServedApp {
  /** The public path that app publishes under, which it answers for here. */
  publicPath: string;
  /** The site's own base path, which every other app is served beneath. */
  siteBase: string;
}

/**
 * Whether this is a development-mode build: `NODE_ENV` says `development`, and
 * nothing narrower is read, so a plain `NODE_ENV=development` rspack run
 * answers true here exactly as a development server does.
 *
 * That is the whole condition the overrides below are guarded by, and it is
 * enough for what they must never reach: `@nx/rspack:dev-server` sets
 * `development` before it builds anything and the build executor sets
 * `production`, so no artifact-producing build can take them. `serve-dev.mjs`
 * sets it explicitly rather than relying on that default, so an ambient
 * `NODE_ENV` cannot leave a development server building production output it
 * then fails to hot-update.
 */
export const isDevelopmentBuild = () => process.env.NODE_ENV === "development";

/**
 * One `<script>`/`<link>` the document plugin below decides about, narrowed to
 * the two fields that decision reads. rspack's own tag type carries more, and
 * the hook is a waterfall that hands its data straight on, so the groups stay
 * whatever rspack gave rather than being rebuilt as this shape.
 */
interface AssetTag {
  tagName: string;
  attributes: Record<string, unknown>;
}

interface AssetTagGroups {
  headTags: AssetTag[];
  bodyTags: AssetTag[];
}

const containerEntry = /(?:^|\/)remoteEntry\.js$/;

const isContainerEntry = (tag: AssetTag) =>
  tag.tagName === "script" &&
  typeof tag.attributes.src === "string" &&
  containerEntry.test(tag.attributes.src);

/**
 * The development document, with the app's own Module Federation container
 * entry left out of it.
 *
 * A federated app has two entries — the page entry a developer opens, and the
 * container `remoteEntry.js` a host consumes over the network — and
 * `HtmlRspackPlugin` writes a script tag for both. Loading both puts two rspack
 * runtimes, and so two dev-server clients and two hot-update states, in one
 * document; their `module.hot.check()` calls then race, and the loser asks the
 * server for a hot-update chunk the compilation that beat it has already
 * replaced. The page stops updating, reporting only `Loading hot update chunk
 * failed`. Nothing needs the container in this document: the host fetches it
 * from its own, so it is still built, still served, and still consumed exactly
 * as before.
 */
export function withoutContainerEntry<Groups extends AssetTagGroups>(
  groups: Groups,
): Groups {
  return Object.assign({}, groups, {
    headTags: groups.headTags.filter((tag) => !isContainerEntry(tag)),
    bodyTags: groups.bodyTags.filter((tag) => !isContainerEntry(tag)),
  });
}

/** The half of swc's React transform this server has an opinion about. */
interface ReactTransform {
  development?: boolean;
  refresh?: boolean;
}

const reactTransformOf = (rule: unknown): ReactTransform | undefined => {
  // A module rule's `options` belongs to whichever loader the rule names, so
  // rspack types it as `unknown` and no published type describes swc's half of
  // it. The assertion below buys the traversal down to `react` and nothing
  // else: the value it lands on is still `unknown`, and the return narrows it
  // before any caller sees it, so what escapes the checker is the path rather
  // than the value this function answers with.
  const react = (
    rule as {
      options?: { jsc?: { transform?: { react?: unknown } } };
    }
  )?.options?.jsc?.transform?.react;
  return typeof react === "object" && react !== null ? react : undefined;
};

/**
 * Compiles the app under development against the same JSX runtime its
 * production-built siblings use.
 *
 * `react` is a shared eager singleton across every container, so one React
 * instance serves a composed page, and whose it is depends on which app is
 * being served from source. A pane's host is the composed artifact, so the
 * instance is that build's production React — while a development build emits
 * `jsxDEV` and bundles React's development JSX runtime, which reaches for
 * internals only a development React has. The pane rendered nothing inside its
 * host and reported `dispatcher.getOwner is not a function`, with every sibling
 * pane rendering around it. Serving the host from source is the other way
 * round: it provides the instance, so nothing has to be aligned and React's
 * own development build — and the fast refresh that needs it — is kept.
 */
export function alignJsxRuntimeWithSiblings(rules: readonly unknown[]) {
  for (const rule of rules) {
    const react = reactTransformOf(rule);
    if (react) react.development = false;
  }
}

/**
 * React's JSX runtime, resolved to the build a production sibling's React
 * expects.
 *
 * `react/jsx-runtime` is a two-line module that picks a build out of
 * `react/cjs` by `process.env.NODE_ENV`, and a development server defines that
 * as `development`. React publishes no export path for the file underneath, so
 * the alias is an absolute path resolved through the one manifest React does
 * publish rather than a deep specifier no resolver would accept.
 */
export function productionJsxRuntime(
  resolve = createRequire(import.meta.url).resolve,
): Record<string, string> {
  const react = dirname(resolve("react/package.json"));
  return {
    "react/jsx-runtime": join(react, "cjs/react-jsx-runtime.production.js"),
    "react/jsx-dev-runtime": join(
      react,
      "cjs/react-jsx-dev-runtime.production.js",
    ),
  };
}

/**
 * The two things a development server has to change about a compilation that
 * neither the build configuration nor the dev-server executor can: the document
 * it generates, and — for an app whose React comes from a production-built
 * host — the JSX runtime it compiles against.
 */
export class DevelopmentServerPlugin {
  /** Whether the React instance this app renders against is a sibling's. */
  readonly rendersAgainstSiblingReact: boolean;

  constructor(rendersAgainstSiblingReact: boolean) {
    this.rendersAgainstSiblingReact = rendersAgainstSiblingReact;
  }

  /* v8 ignore start -- Hook and option wiring inside a real rspack compilation, which v8 cannot instrument from a test process; serve-dev.spec.ts drives both through the real development server and a real browser, and each decision they register is covered directly. */
  apply(compiler: Compiler) {
    if (this.rendersAgainstSiblingReact)
      alignJsxRuntimeWithSiblings(compiler.options.module.rules);
    compiler.hooks.compilation.tap("DevelopmentServerPlugin", (compilation) =>
      HtmlRspackPlugin.getCompilationHooks(compilation).alterAssetTagGroups.tap(
        "DevelopmentServerPlugin",
        (groups) => withoutContainerEntry(groups),
      ),
    );
  }
  /* v8 ignore stop */
}

/**
 * The development server one app is served from source by, with every other app
 * served from the composed artifact on disk.
 *
 * Both halves answer on one origin at the site's own base path, which is what
 * lets the remote URLs a production build emits resolve unchanged: they are
 * origin-relative, so `http://127.0.0.1:<port>/<base>/remotes/<remote>/` is the
 * same path the deployed site publishes each container under. Nothing about
 * where a container resolves is overridden; what changes is which of the two
 * answers for it.
 *
 * The host is the exception to serving the artifact whole. Its own route
 * documents are prerendered into that tree against a production bundle, so
 * serving them would answer `/bio` with the built shell while `/` answered with
 * the one under development. Only the parts the shell consumes rather than
 * produces — the remotes and the CV data — are served for it, and every route
 * falls back to the document rspack is building.
 */
export function developmentServer({
  publicPath,
  siteBase,
}: ServedApp): Configuration["devServer"] {
  const servesTheHost = publicPath === siteBase;
  return {
    hot: true,
    // The app under development answers for its own public path out of memory;
    // everything below is read off the composed artifact.
    devMiddleware: { publicPath },
    static: servesTheHost
      ? [
          {
            directory: `${composedArtifactRoot}/remotes`,
            publicPath: `${siteBase}remotes/`,
          },
          {
            directory: `${composedArtifactRoot}/cv-data`,
            publicPath: `${siteBase}cv-data/`,
          },
        ]
      : [{ directory: composedArtifactRoot, publicPath: siteBase }],
    historyApiFallback: { index: `${siteBase}index.html` },
    headers: { "Access-Control-Allow-Origin": "*" },
  };
}

/**
 * Everything the development overrides below replace or add. A build
 * configuration is held to it on the way in and carries it on the way out, so a
 * caller reads back what a development server was given rather than what a
 * production build declared.
 *
 * The three fields this module can add to a configuration that never declared
 * them — `resolve`, `devServer`, `watchOptions` — are rspack's own types rather
 * than looser stand-ins, because for those the stand-in is what the returned
 * intersection ends up carrying, and a caller handing that result straight to
 * `rspack()` would stop typechecking against a shape rspack never uses. The two
 * every caller here already declares stay loose: the intersection keeps the
 * caller's own type for them.
 */
export interface DevelopmentOverrides {
  output?: Record<string, unknown>;
  plugins?: unknown[];
  resolve?: Configuration["resolve"];
  devServer?: Configuration["devServer"];
  watchOptions?: Configuration["watchOptions"];
}

/**
 * One app's build configuration, unchanged unless this is a development-mode
 * build — which in practice is the development server serving that app from
 * source, since it is the only thing in this workspace that builds under
 * `NODE_ENV=development`.
 *
 * Three of the overrides are what make an edit reach the running page at all,
 * and each was measured against a server that did not have it:
 *
 * - `clean` deletes every asset the last compilation did not emit, and a
 *   hot-update chunk is exactly that, so the browser asked for one the server
 *   had already removed.
 * - a content hash in an asset name cannot be known by the runtime that has to
 *   request the updated stylesheet, so the CSS hot update asked for a name that
 *   never existed and the update was abandoned.
 * - `PublishedFragmentPlugin` compiles a second production bundle and writes
 *   `fragment.html`, `fragment.css` and `fragment.json` into the output
 *   directory on every compilation. Under a development server that directory
 *   is the composed artifact this server is reading, so every keystroke
 *   rewrote the bytes it was serving. It is replaced by the document plugin
 *   above rather than dropped, so the federation container stays the last
 *   plugin a host's configuration declares.
 */
export function withDevelopmentOverrides<Config extends DevelopmentOverrides>(
  config: Config,
  served: ServedApp,
): Config & DevelopmentOverrides {
  if (!isDevelopmentBuild()) return config;
  // A pane renders against the composed host's production React, so both halves
  // of the JSX runtime it reaches that instance through have to be production
  // too: the calls its own source compiles to, and the React module those calls
  // land in. The host serving itself from source provides the instance instead,
  // so it keeps React's development build and the fast refresh that needs it.
  const rendersAgainstSiblingReact = served.publicPath !== served.siteBase;
  return Object.assign({}, config, {
    output: {
      ...config.output,
      clean: false,
      filename: "[name].js",
      chunkFilename: "[name].js",
      cssFilename: "[name].css",
      cssChunkFilename: "[name].css",
    },
    plugins: (config.plugins ?? []).map((plugin) =>
      plugin instanceof PublishedFragmentPlugin
        ? new DevelopmentServerPlugin(rendersAgainstSiblingReact)
        : plugin,
    ),
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        ...(rendersAgainstSiblingReact ? productionJsxRuntime() : {}),
      },
    },
    devServer: developmentServer(served),
    // An editor that truncates before it writes produces two filesystem events,
    // and rspack's default aggregation is short enough to compile both. The
    // second compilation replaces the first one's hot-update chunks before the
    // browser has fetched them, so one edit has to be one compilation.
    watchOptions: { aggregateTimeout: 400 },
  });
}
