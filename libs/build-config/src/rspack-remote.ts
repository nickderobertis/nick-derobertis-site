import { createRequire } from "node:module";
import { resolve } from "node:path";
import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";
import type { Compiler } from "@rspack/core";
import { consumeFederatedTypes, FederatedTypesPlugin } from "./federated-types";
import { PublishedFragmentPlugin } from "./published-fragment";
import { type RemoteProject, remoteRegistry } from "./remote-registry";
import { isDevelopmentBuild, withDevelopmentOverrides } from "./rspack-dev";

const siteConfig: unknown = createRequire(import.meta.url)(
  "../../data-access-core/src/site.config.json",
);
/* v8 ignore start -- This guard runs at import over a committed build input that just check already validates through every consumer; only a corrupted checkout reaches its rejection branch, and the named diagnostic is what makes that failure readable. */
// llmlint: ignore[changed_behavior_has_e2e] This guard rejects a malformed build input before any bundle exists, so nothing it refuses can reach a visitor and there is no browser interface to drive; rspack-remote.spec.ts covers the configuration it produces, and every app's ownership.spec.ts drives the remote that configuration builds through both boundaries.
if (
  typeof siteConfig !== "object" ||
  siteConfig === null ||
  !("pagesBase" in siteConfig) ||
  typeof siteConfig.pagesBase !== "string" ||
  !/^\/[a-z0-9-]+$/.test(siteConfig.pagesBase)
)
  throw new Error("site.config.json must define a valid pagesBase");
/* v8 ignore stop */
const pagesBase = siteConfig.pagesBase;

/**
 * The share scope every container in this workspace is built with, and the one
 * the shell declares as well: the host is what supplies these instances to the
 * containers it composes, so the two declarations have to name the same modules
 * and are therefore the same declaration.
 *
 * Everything here is a singleton with version checking off, because there is
 * one version of each in this repository -- these are workspace libraries and
 * one pinned dependency, not a range negotiated with anybody -- so the instance
 * that loaded first is always the right one.
 *
 * `react` and `react-dom` are eager because each container's own entry uses
 * them before it can reach an async boundary. The rest are deliberately not:
 * an eager share is resolved during share-scope startup, which is the moment
 * the shell's `loaded-first` strategy exists to keep free of work no route has
 * asked for. Left non-eager, a container reaches for one of them only when a
 * route it is rendering does, and finds the host's copy already in the scope.
 *
 * A container loaded standalone has no host to find one from, so each build
 * still emits its own fallback copy of every module here and resolves to that.
 *
 * A share reached from a container's initial chunk is resolved synchronously,
 * before that container has a scope to resolve it in, so an entry has to reach
 * these modules through a dynamic import. Every remote's `main.tsx` does; the
 * shell, whose entry reaches route state through its own router, declares
 * `asyncShareStartup` instead.
 *
 * The share scope keys an instance on a package's name and version, so each
 * workspace library named here declares a version in its own manifest. Without
 * one Module Federation registers nothing for it, and every container falls
 * back to its own copy -- which is the duplication this scope exists to end,
 * with none of the configuration above looking wrong.
 */
// `as const` because `requiredVersion: false` is the literal that turns version
// checking off; widened to `boolean` it is no longer a value the share scope
// accepts.
export const sharedSingletons = {
  react: { singleton: true, requiredVersion: false, eager: true },
  "react-dom": { singleton: true, requiredVersion: false, eager: true },
  "@site/route-state": { singleton: true, requiredVersion: false },
  "@site/design-system": { singleton: true, requiredVersion: false },
  "@site/data-access-core/validators": {
    singleton: true,
    requiredVersion: false,
  },
  zod: { singleton: true, requiredVersion: false },
} as const;

/**
 * Module Federation's own way of putting a container's startup behind share
 * initialization, which is what lets an entry chunk reach a non-eager share
 * directly. Only the shell declares it, and only the shell may: a remote built
 * with it hands a host that composes it a container whose eager react share
 * resolves to nothing, so every route the shell composed failed on the first
 * hook a remote's page called. A remote's own entry reaches the shares above
 * through an awaited dynamic import instead, which its `main.tsx` shows.
 */
// Keep the literal `true`: without the assertion TypeScript widens it to
// `boolean`, which is not assignable to Module Federation's startup option.
export const asyncShareStartup = { asyncStartup: true } as const;

/**
 * Keeps a remote's exposes in chunks of their own.
 *
 * Nx gives every build a `common` cache group that pulls each module two of its
 * async chunks share into one chunk, enforced, with no minimum size. With the
 * libraries above out of each container, what a pane's `./Page` and
 * `./Skeleton` have left is small enough that the group collapsed both exposes
 * into a single chunk -- which makes the per-pane fallback Home composes
 * unobservable, because the skeleton would arrive in the same request as the
 * page it stands in for. Only that group is dropped: Nx's `default` group beside
 * it takes the same modules once they are worth a chunk, which is what keeps a
 * page's own payload from being emitted twice.
 *
 * `NxAppRspackPlugin` replaces this build's whole `optimization` when it
 * applies, so declaring it in the configuration above would be overwritten;
 * this runs after that plugin, which is what makes it stick.
 */
class SeparateExposedChunksPlugin {
  apply(compiler: Compiler) {
    const splitChunks = compiler.options.optimization?.splitChunks;
    /* v8 ignore start -- Reachable only inside a real rspack build, where Nx's app plugin has already put a splitChunks object here; rspack-remote.spec.ts asserts the plugin is in the build, and every app's ownership.spec.ts drives the exposes it keeps apart through both boundaries. */
    if (typeof splitChunks !== "object" || !splitChunks.cacheGroups) return;
    splitChunks.cacheGroups.common = false;
    /* v8 ignore stop */
  }
}

export function remoteMap(names: readonly RemoteProject[]) {
  return Object.fromEntries(
    names.map((name) => [
      remoteRegistry[name],
      `${remoteRegistry[name]}@${pagesBase}/remotes/${name}/remoteEntry.js`,
    ]),
  );
}

interface RemoteOptions {
  remotes?: Record<string, string>;
  /**
   * Whether this remote publishes its loading skeleton across the boundary.
   * Only Home composes panes behind a per-pane fallback, so only a pane owes
   * one: the shell reaches its route pages through the router's own pending
   * boundary and never asks a route remote for a skeleton. A remote no host
   * consumes it from would ship a second entry chunk and a second generated
   * declaration that nothing imports.
   */
  skeleton?: boolean;
}

export function remoteExposes(options: Pick<RemoteOptions, "skeleton"> = {}) {
  return {
    "./Page": "./src/page.tsx",
    ...(options.skeleton ? { "./Skeleton": "./src/skeleton.tsx" } : undefined),
  };
}

export function remoteConfig(name: string, options: RemoteOptions = {}) {
  const root = `apps/${name}`;
  const publicPath = `${pagesBase}/remotes/${name}/`;
  // The `in` guard has already established the key, but TypeScript does not
  // narrow an arbitrary string to a manifest key, so the branch says so.
  const federationName =
    name in remoteRegistry ? remoteRegistry[name as RemoteProject] : name;
  const exposes = remoteExposes(options);
  const composed = Object.keys(options.remotes ?? {});
  // Declarations are the contract between the build that publishes a remote's
  // bytes and the host build that typechecks against them, and a development
  // server is neither of those: it publishes nothing and typechecks nothing.
  // So a development build declares no `dts` below and adds no plugin holding
  // it to one. Left on, the generator defers its work under a watching
  // compiler and had written nothing by the time the compilation sealed, so
  // every hot rebuild failed on the declarations it was still about to write --
  // having first cleared the ones `just check`'s typecheck reads.
  const publishesTypes = !isDevelopmentBuild();
  // Held in this binding as well as in the plugin list below because the
  // declaration generator hands its result back to this same instance: it is
  // the one that knows where this build wrote, which is where the declarations
  // landed. A development build reaches neither, so it holds nothing.
  const federatedTypes = new FederatedTypesPlugin({
    generates: {
      project: name,
      alias: federationName,
      exposes: Object.keys(exposes),
    },
    ...(composed.length ? { consumes: { host: name, aliases: composed } } : {}),
  });
  // Unchanged unless this remote is the one a development server is building
  // from source; nothing a production build emits passes through the branch.
  // llmlint: ignore[changed_behavior_has_e2e] The overrides this call adds are taken only under `NODE_ENV=development`, so no byte a visitor is served is built through them and there is no route, empty, loading, or error state of the remote's page they can change: the same components render those states either way, and apps/<name>/e2e/<name>.spec.ts and apps/<name>/e2e/ownership.spec.ts already drive every one of them standalone and host-composed against the built artifact. What is new here is delivery, and serve-dev.spec.ts drives that in a real browser through both shapes it takes — the composing host and a remote pane, whose edit it follows into that host — along with its two failure paths, an app this workspace cannot serve and an artifact that cannot be composed.
  return withDevelopmentOverrides(
    {
      // Nx's app plugin sets this same project root on the compiler options it
      // is given, but it does so after the compiler was constructed, so the
      // context captured at construction stays the workspace root. Declaring it
      // here is what lets the declaration generator below resolve each expose
      // from the same directory rspack resolves it from.
      context: resolve(root),
      entry: `./${root}/src/main.tsx`,
      output: { publicPath, uniqueName: name, clean: true },
      optimization: { runtimeChunk: false },
      plugins: [
        new NxAppRspackPlugin({
          tsConfig: `${root}/tsconfig.app.json`,
          main: `${root}/src/main.tsx`,
          index: `${root}/src/index.html`,
          baseHref: publicPath,
          assets: [],
          outputHashing: "all",
          optimization: true,
          runtimeChunk: false,
        }),
        new SeparateExposedChunksPlugin(),
        new NxReactRspackPlugin(),
        // llmlint: ignore[changed_behavior_has_e2e] Each app's ownership.spec.ts drives its published remote through standalone and host-composed browser boundaries, and the feature journey specs cover their happy and recovery states.
        new PublishedFragmentPlugin(name),
        // llmlint: ignore[changed_behavior_has_e2e] This holds a build to the declarations it owes, which is a compile-time contract with no browser interface: what it refuses is a build that produced no artifact for a visitor to load, and what it allows is the same bytes the build already emitted. federated-types.spec.ts drives both halves, and every app's ownership.spec.ts drives the remote this configuration builds through both boundaries.
        ...(publishesTypes ? [federatedTypes] : []),
        new ModuleFederationPlugin({
          name: federationName,
          filename: "remoteEntry.js",
          // llmlint: ignore[microfrontends_split_aggressively] Skeleton is the declared dependency-light loading boundary Home renders while a pane's Page chunk resolves, and only a pane Home composes exposes one; no feature implementation internals are exposed.
          exposes,
          // Each host typechecks its federated imports against declarations
          // compiled from these exposes, so the remote's real component types
          // cross the boundary instead of a hand-written restatement of them.
          dts: publishesTypes && {
            generateTypes: {
              // Resolved from the context above, which is this remote's own root.
              tsConfigPath: "tsconfig.app.json",
              // Report a failed declaration compile with the compiler's own
              // diagnostic rather than skipping it quietly. The same files are
              // compiled again by this remote's typecheck target, so a failure
              // here is one just check reports there as well.
              abortOnError: true,
              // Hosts import each expose by name rather than through the
              // runtime's loadRemote, so its generic API declaration has no
              // consumer here.
              generateAPITypes: false,
              deleteTypesFolder: false,
              afterGenerate: () => federatedTypes.publish(),
            },
            // A remote that composes remotes of its own consumes their
            // declarations here, because the modules its own exposes are
            // compiled from are the ones that import them.
            consumeTypes: composed.length
              ? consumeFederatedTypes(name, composed)
              : false,
          },
          remotes: options.remotes ?? {},
          shared: sharedSingletons,
        }),
      ],
    },
    { publicPath, siteBase: `${pagesBase}/` },
  );
}
