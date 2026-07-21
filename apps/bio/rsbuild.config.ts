import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const publicPath = "/nick-derobertis-site/remotes/bio/";

export default defineConfig({
  source: {
    entry: { index: "./apps/bio/src/main.tsx" },
    tsconfigPath: "./tsconfig.base.json",
  },
  output: {
    assetPrefix: publicPath,
    distPath: { root: "dist/apps/bio" },
    cleanDistPath: true,
  },
  html: { template: "./apps/bio/src/index.html" },
  server: { port: 4215, base: publicPath, cors: true },
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: "bio",
      filename: "remoteEntry.js",
      exposes: { "./Page": "./apps/bio/src/page.tsx" },
      shared: {
        react: { singleton: true, requiredVersion: false, eager: true },
        "react-dom": { singleton: true, requiredVersion: false, eager: true },
      },
    }),
  ],
});
