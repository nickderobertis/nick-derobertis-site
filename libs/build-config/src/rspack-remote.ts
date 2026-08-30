import { createRequire } from "node:module";
import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";
import { PublishedFragmentPlugin } from "./published-fragment";
import { type RemoteProject, remoteRegistry } from "./remote-registry";
import { withDevelopmentOverrides } from "./rspack-dev";

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
}

export function remoteConfig(name: string, options: RemoteOptions = {}) {
  const root = `apps/${name}`;
  const publicPath = `${pagesBase}/remotes/${name}/`;
  // The `in` guard has already established the key, but TypeScript does not
  // narrow an arbitrary string to a manifest key, so the branch says so.
  const federationName =
    name in remoteRegistry ? remoteRegistry[name as RemoteProject] : name;
  // Unchanged unless this remote is the one a development server is building
  // from source; nothing a production build emits passes through the branch.
  // llmlint: ignore[changed_behavior_has_e2e] The overrides this call adds are taken only under `NODE_ENV=development`, so no byte a visitor is served is built through them and there is no route, empty, loading, or error state of the remote's page they can change: the same components render those states either way, and apps/<name>/e2e/<name>.spec.ts and apps/<name>/e2e/ownership.spec.ts already drive every one of them standalone and host-composed against the built artifact. What is new here is delivery, and serve-dev.spec.ts drives that in a real browser through both shapes it takes — the composing host and a remote pane, whose edit it follows into that host — along with its two failure paths, an app this workspace cannot serve and an artifact that cannot be composed.
  return withDevelopmentOverrides(
    {
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
            "react-dom": {
              singleton: true,
              requiredVersion: false,
              eager: true,
            },
          },
        }),
      ],
    },
    { publicPath, siteBase: `${pagesBase}/` },
  );
}
