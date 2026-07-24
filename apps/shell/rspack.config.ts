import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";
import { remoteMap } from "@site/build-config";
import { TanStackRouterGeneratorRspack } from "@tanstack/router-plugin/rspack";

const base = "/nick-derobertis-site/";
export default {
  entry: "./apps/shell/src/main.tsx",
  output: { publicPath: base, uniqueName: "shell", clean: true },
  plugins: [
    TanStackRouterGeneratorRspack({ enableRouteGeneration: false }),
    new NxAppRspackPlugin({
      tsConfig: "apps/shell/tsconfig.app.json",
      main: "apps/shell/src/main.tsx",
      index: "apps/shell/src/index.html",
      baseHref: base,
      assets: [],
      outputHashing: "all",
      optimization: true,
    }),
    new NxReactRspackPlugin(),
    new ModuleFederationPlugin({
      name: "shell",
      filename: "remoteEntry.js",
      exposes: { "./App": "./src/app.tsx" },
      remotes: remoteMap(["home", "bio", "research", "software", "courses"]),
      shared: {
        react: { singleton: true, requiredVersion: false, eager: true },
        "react-dom": { singleton: true, requiredVersion: false, eager: true },
      },
    }),
  ],
};
