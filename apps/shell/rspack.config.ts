import { resolve } from "node:path";
import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";
import {
  consumeFederatedTypes,
  FederatedTypesPlugin,
  isDevelopmentBuild,
  PublishedFragmentPlugin,
  remoteMap,
  withDevelopmentOverrides,
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
// The route remotes' declarations are what this build typechecks its federated
// imports against, and a development server typechecks nothing: it compiles the
// shell's source for a browser and leaves `just check` to typecheck it. So a
// development build declares no `dts` below and adds no plugin holding it to
// one, which also keeps a hot rebuild from re-unpacking every archive over the
// tree that build's own typecheck reads.
const consumesTypes = !isDevelopmentBuild();
// Unchanged unless the shell is what a development server is building from
// source; nothing a production build emits passes through that branch.
// llmlint: ignore[changed_behavior_has_e2e] The overrides this call adds are taken only under `NODE_ENV=development`, so no byte a visitor is served is built through them and there is no route, empty, loading, or error state of the site the shell routes they can change: the same components render those states either way, and site.spec.ts and every app's own journey spec already drive every one of them standalone and host-composed against the built artifact. What is new here is delivery, and serve-dev.spec.ts drives that in a real browser through both shapes it takes — the composing host and a remote pane, whose edit it follows into that host — along with its two failure paths, an app this workspace cannot serve and an artifact that cannot be composed.
export default withDevelopmentOverrides(
  {
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
      ...(consumesTypes
        ? [
            new FederatedTypesPlugin({
              consumes: { host: "shell", aliases: routeAliases },
            }),
          ]
        : []),
      new ModuleFederationPlugin({
        name: "shell",
        filename: "remoteEntry.js",
        remotes: routeRemotes,
        // The shell publishes no exposes, so it has no declarations of its own
        // to compile. It reads each route remote's from the archive that
        // remote's build published, so what it typechecks against is what the
        // remote really exposes.
        dts: consumesTypes && {
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
  },
  { publicPath: base, siteBase: base },
);
