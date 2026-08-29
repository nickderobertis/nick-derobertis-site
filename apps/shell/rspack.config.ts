import { resolve } from "node:path";
import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";
import {
  consumeFederatedTypes,
  FederatedTypesPlugin,
  PublishedFragmentPlugin,
  remoteMap,
} from "@site/build-config";

const base = "/nick-derobertis-site/";
const routeRemotes = remoteMap([
  "home",
  "bio",
  "research",
  "software",
  "courses",
]);
const routeAliases = Object.keys(routeRemotes);
export default {
  // Nx's app plugin sets this same project root on the compiler options it is
  // given, but only after the compiler was constructed, so the context the
  // declaration consumer below reads would otherwise be the workspace root.
  context: resolve("apps/shell"),
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
    // llmlint: ignore[changed_behavior_has_e2e] This holds the build to the declarations it consumed, which is a compile-time contract with no browser interface: what it refuses is a build that produced no artifact for a visitor to load, and what it allows is the same bytes the build already emitted. federated-types.spec.ts drives it, and site.spec.ts drives the artifact this configuration builds.
    new FederatedTypesPlugin({
      consumes: { host: "shell", aliases: routeAliases },
    }),
    new ModuleFederationPlugin({
      name: "shell",
      filename: "remoteEntry.js",
      remotes: routeRemotes,
      // The shell publishes no exposes, so it has no declarations of its own
      // to compile. It reads each route remote's from the archive that
      // remote's build published, so what it typechecks against is what the
      // remote really exposes.
      dts: {
        generateTypes: false,
        consumeTypes: consumeFederatedTypes("shell", routeAliases),
      },
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
