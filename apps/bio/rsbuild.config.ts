import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const siteConfig: unknown = JSON.parse(
  readFileSync(
    new URL("../../libs/data-access/src/site.config.json", import.meta.url),
    "utf8",
  ),
);
const remoteManifest: unknown = JSON.parse(
  readFileSync(
    new URL("../../libs/build-config/src/remotes.json", import.meta.url),
    "utf8",
  ),
);
if (
  typeof siteConfig !== "object" ||
  siteConfig === null ||
  !("pagesBase" in siteConfig) ||
  typeof siteConfig.pagesBase !== "string" ||
  !/^\/[a-z0-9-]+$/.test(siteConfig.pagesBase) ||
  typeof remoteManifest !== "object" ||
  remoteManifest === null ||
  !Object.values(remoteManifest).every((alias) => typeof alias === "string")
)
  throw new Error("Bio project, site, or remote configuration is invalid");
const projectName = basename(dirname(fileURLToPath(import.meta.url)));
if (
  !(projectName in remoteManifest) ||
  typeof remoteManifest[projectName as keyof typeof remoteManifest] !== "string"
)
  throw new Error("The bio project must have a declared federation remote");
if (process.env.NX_TASK_TARGET_PROJECT !== projectName)
  throw new Error(`${projectName} Rsbuild config must be invoked through Nx`);
const outputRoot = `dist/apps/${projectName}`;
const publicPath = `${siteConfig.pagesBase}/remotes/${projectName}/`;
const federationName = remoteManifest[
  projectName as keyof typeof remoteManifest
] as string;

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
      name: federationName,
      filename: "remoteEntry.js",
      exposes: { "./Page": "./apps/bio/src/page.tsx" },
      shared: {
        react: { singleton: true, requiredVersion: false, eager: true },
        "react-dom": { singleton: true, requiredVersion: false, eager: true },
      },
    }),
  ],
});
