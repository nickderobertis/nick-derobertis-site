import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin.js";
import { NxReactRspackPlugin } from "@nx/rspack/react-plugin.js";
import { z } from "zod";
import remoteInput from "./src/remotes.json" with { type: "json" };

const base = "/nick-derobertis-site/";
// llmlint: ignore[changed_behavior_has_e2e] This build-time configuration validation has no browser interface; successful federation loading is covered through host-composed Playwright journeys.
const remoteNames = z.array(z.string().min(1)).parse(remoteInput);
const remotes = Object.fromEntries(
  remoteNames.map((name) => [
    name,
    `${name}@${base}remotes/${name}/remoteEntry.js`,
  ]),
);
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
      remotes,
      shared: {
        react: { singleton: true, requiredVersion: false, eager: true },
        "react-dom": { singleton: true, requiredVersion: false, eager: true },
      },
    }),
  ],
};
