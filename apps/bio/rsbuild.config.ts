import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const publicPath = "/nick-derobertis-site/remotes/bio/";
if (process.env.NX_TASK_TARGET_PROJECT !== "bio")
  throw new Error("The bio Rsbuild config must be invoked through Nx");
const outputRoot = `dist/apps/${process.env.NX_TASK_TARGET_PROJECT}`;

// llmlint: ignore[changed_behavior_has_e2e] bio.spec.ts and remote-owner.spec.ts exercise the real Rsbuild artifact's happy, empty, loading, and error states through standalone and host-composed paths.
export default defineConfig({
  source: {
    entry: { index: "./apps/bio/src/main.tsx" },
    tsconfigPath: "./tsconfig.base.json",
  },
  output: {
    assetPrefix: publicPath,
    distPath: { root: outputRoot },
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
