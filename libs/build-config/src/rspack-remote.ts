import { createRequire } from "node:module";
import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";

const remoteManifest = createRequire(import.meta.url)(
  "./remotes.json",
) as typeof import("./remotes.json");
const siteConfig: unknown = createRequire(import.meta.url)(
  "../../data-access/src/site.config.json",
);
if (
  Object.entries(remoteManifest).some(
    ([key, value]) => !/^[a-z][a-z-]+$/.test(key) || typeof value !== "string",
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
  federationName?: string;
  remotes?: Record<string, string>;
}

export function remoteConfig(name: string, options: RemoteOptions = {}) {
  const root = `apps/${name}`;
  const publicPath = `${pagesBase}/remotes/${name}/`;
  const federationName = options.federationName ?? name;
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
      new ModuleFederationPlugin({
        name: federationName,
        filename: "remoteEntry.js",
        exposes: { "./Page": "./src/page.tsx" },
        remotes:
          options.remotes ??
          (name === "research"
            ? {
                software:
                  "software@/nick-derobertis-site/remotes/software/remoteEntry.js",
              }
            : {}),
        shared: {
          react: { singleton: true, requiredVersion: false, eager: true },
          "react-dom": { singleton: true, requiredVersion: false, eager: true },
        },
      }),
    ],
  };
}
