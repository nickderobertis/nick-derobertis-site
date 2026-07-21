import { createRequire } from "node:module";
import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const remoteManifest = createRequire(import.meta.url)(
  "../../libs/build-config/src/remotes.json",
) as typeof import("../../libs/build-config/src/remotes.json");

const base = "/nick-derobertis-site/";
const remoteMap = (names: readonly (keyof typeof remoteManifest)[]) =>
  Object.fromEntries(
    names.map((name) => [
      remoteManifest[name],
      `${remoteManifest[name]}@${base}remotes/${name}/remoteEntry.js`,
    ]),
  );

export default defineConfig({
  source: {
    entry: { index: "./apps/shell/src/main.tsx" },
    tsconfigPath: "./tsconfig.base.json",
  },
  output: {
    assetPrefix: base,
    distPath: { root: "dist/apps/shell" },
    cleanDistPath: true,
  },
  html: { template: "./apps/shell/src/index.html" },
  server: { port: 4200, base, cors: true },
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: "shell",
      filename: "remoteEntry.js",
      exposes: { "./App": "./apps/shell/src/app.tsx" },
      remotes: remoteMap(["home", "bio", "research", "software", "courses"]),
      shared: {
        react: { singleton: true, requiredVersion: false, eager: true },
        "react-dom": { singleton: true, requiredVersion: false, eager: true },
      },
    }),
  ],
});
