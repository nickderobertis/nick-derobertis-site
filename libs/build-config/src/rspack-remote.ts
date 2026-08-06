import { createRequire } from "node:module";
import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";
import { PublishedFragmentPlugin } from "./published-fragment";

// `require` returns `any`, so the checked-in JSON's own inferred type is
// restored here and the entry shapes are validated below before any use.
const remoteManifest = createRequire(import.meta.url)(
  "./remotes.json",
) as typeof import("./remotes.json");
const siteConfig: unknown = createRequire(import.meta.url)(
  "../../data-access-core/src/site.config.json",
);
/* v8 ignore start -- Both guards run at import over committed build inputs that just check already validates through every consumer; only a corrupted checkout reaches their rejection branches, and the named diagnostic is what makes that failure readable. */
// llmlint: ignore[changed_behavior_has_e2e] These guards reject a malformed build input before any bundle exists, so nothing they refuse can reach a visitor and there is no browser interface to drive; rspack-remote.spec.ts covers the configuration they produce, and every app's ownership.spec.ts drives the remote that configuration builds through both boundaries.
if (
  typeof remoteManifest !== "object" ||
  remoteManifest === null ||
  Array.isArray(remoteManifest) ||
  Object.entries(remoteManifest).some(
    ([key, value]) =>
      !/^[a-z][a-z-]+$/.test(key) ||
      typeof value !== "string" ||
      !/^[a-z][A-Za-z]*$/.test(value),
  )
)
  throw new Error("remotes.json must contain string remote-name mappings");
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

export type RemoteProject = keyof typeof remoteManifest;

export function remoteMap(names: readonly RemoteProject[]) {
  return Object.fromEntries(
    names.map((name) => [
      remoteManifest[name],
      `${remoteManifest[name]}@${pagesBase}/remotes/${name}/remoteEntry.js`,
    ]),
  );
}

interface RemoteOptions {
  remotes?: Record<string, string>;
}

export function remoteConfig(name: string, options: RemoteOptions = {}) {
  const root = `apps/${name}`;
  const publicPath = `${pagesBase}/remotes/${name}/`;
  // The `in` guard has already established the key, but TypeScript does not
  // narrow an arbitrary string to a manifest key, so the branch says so.
  const federationName =
    name in remoteManifest ? remoteManifest[name as RemoteProject] : name;
  return {
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
      new ModuleFederationPlugin({
        name: federationName,
        filename: "remoteEntry.js",
        // llmlint: ignore[microfrontends_split_aggressively] Skeleton is the declared dependency-light loading boundary consumed by the shell while the route-level Page chunk resolves; no feature implementation internals are exposed.
        exposes: {
          "./Page": "./src/page.tsx",
          "./Skeleton": "./src/skeleton.tsx",
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
