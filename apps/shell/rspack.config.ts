import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";
import { remoteMap } from "@site/build-config";

const base = "/nick-derobertis-site/";
export default {
  entry: "./apps/shell/src/main.tsx",
  output: { publicPath: base, uniqueName: "shell", clean: true },
  plugins: [
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
      // The default `version-first` strategy loads every declared remote's
      // remoteEntry.js during share-scope startup to negotiate versions, which
      // would fetch all five route containers no matter how late the shell
      // imports their pages. Nothing here needs that negotiation: react and
      // react-dom below are eager singletons with version checks off, so the
      // host's instance always wins, and each container can wait until the
      // router asks for its route.
      shareStrategy: "loaded-first",
      shared: {
        react: { singleton: true, requiredVersion: false, eager: true },
        "react-dom": { singleton: true, requiredVersion: false, eager: true },
      },
    }),
  ],
};
