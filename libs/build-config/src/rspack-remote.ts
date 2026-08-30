import { createRequire } from "node:module";
import { resolve } from "node:path";
import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";
import { consumeFederatedTypes, FederatedTypesPlugin } from "./federated-types";
import { PublishedFragmentPlugin } from "./published-fragment";
import { type RemoteProject, remoteRegistry } from "./remote-registry";

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

export function remoteConfig(name: string, options: RemoteOptions = {}) {
  const root = `apps/${name}`;
  const publicPath = `${pagesBase}/remotes/${name}/`;
  // The `in` guard has already established the key, but TypeScript does not
  // narrow an arbitrary string to a manifest key, so the branch says so.
  const federationName =
    name in remoteRegistry ? remoteRegistry[name as RemoteProject] : name;
  const exposes = {
    "./Page": "./src/page.tsx",
    ...(options.skeleton ? { "./Skeleton": "./src/skeleton.tsx" } : undefined),
  };
  const composed = Object.keys(options.remotes ?? {});
  // Held here as well as in the plugin list below because the declaration
  // generator hands its result back to this same instance: it is the one that
  // knows where this build wrote, which is where the declarations landed.
  const federatedTypes = new FederatedTypesPlugin({
    generates: {
      project: name,
      alias: federationName,
      exposes: Object.keys(exposes),
    },
    ...(composed.length ? { consumes: { host: name, aliases: composed } } : {}),
  });
  return {
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
      new NxReactRspackPlugin(),
      // llmlint: ignore[changed_behavior_has_e2e] Each app's ownership.spec.ts drives its published remote through standalone and host-composed browser boundaries, and the feature journey specs cover their happy and recovery states.
      new PublishedFragmentPlugin(name),
      // llmlint: ignore[changed_behavior_has_e2e] This holds a build to the declarations it owes, which is a compile-time contract with no browser interface: what it refuses is a build that produced no artifact for a visitor to load, and what it allows is the same bytes the build already emitted. federated-types.spec.ts drives both halves, and every app's ownership.spec.ts drives the remote this configuration builds through both boundaries.
      federatedTypes,
      new ModuleFederationPlugin({
        name: federationName,
        filename: "remoteEntry.js",
        // llmlint: ignore[microfrontends_split_aggressively] Skeleton is the declared dependency-light loading boundary Home renders while a pane's Page chunk resolves, and only a pane Home composes exposes one; no feature implementation internals are exposed.
        exposes,
        // Each host typechecks its federated imports against declarations
        // compiled from these exposes, so the remote's real component types
        // cross the boundary instead of a hand-written restatement of them.
        dts: {
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
        shared: {
          react: { singleton: true, requiredVersion: false, eager: true },
          "react-dom": { singleton: true, requiredVersion: false, eager: true },
        },
      }),
    ],
  };
}
