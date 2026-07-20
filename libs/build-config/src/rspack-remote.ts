import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";
export function remoteConfig(name: string) {
  const root = `apps/${name}`;
  const publicPath = `/nick-derobertis-site/remotes/${name}/`;
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
        name,
        filename: "remoteEntry.js",
        exposes: { "./Page": "./src/page.tsx" },
        remotes:
          name === "research"
            ? {
                software:
                  "software@/nick-derobertis-site/remotes/software/remoteEntry.js",
              }
            : {},
        shared: {
          react: { singleton: true, requiredVersion: false, eager: true },
          "react-dom": { singleton: true, requiredVersion: false, eager: true },
        },
      }),
    ],
  };
}
