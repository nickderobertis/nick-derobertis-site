import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";
import {
  PublishedFragmentPlugin,
  remoteMap,
  servedInDevelopment,
} from "@site/build-config";

const base = "/nick-derobertis-site/";
// Unchanged unless the shell is what a development server is building from
// source; nothing a production build emits passes through that branch.
export default servedInDevelopment(
  {
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
      // llmlint: ignore[changed_behavior_has_e2e] site.spec.ts drives the shell's composed published bytes with JavaScript disabled and through hydration, while every journey spec drives the same shell artifact through its host-composed boundary.
      new PublishedFragmentPlugin("shell"),
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
  },
  { publicPath: base, siteBase: base },
);
