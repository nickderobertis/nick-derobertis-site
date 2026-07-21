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
const routes: unknown = JSON.parse(
  readFileSync(new URL("./src/routes.json", import.meta.url), "utf8"),
);
if (
  typeof siteConfig !== "object" ||
  siteConfig === null ||
  !("pagesBase" in siteConfig) ||
  typeof siteConfig.pagesBase !== "string" ||
  !/^\/[a-z0-9-]+$/.test(siteConfig.pagesBase) ||
  typeof remoteManifest !== "object" ||
  remoteManifest === null ||
  !Object.entries(remoteManifest).every(
    ([name, alias]) =>
      /^[a-z][a-z0-9-]*$/.test(name) && typeof alias === "string",
  ) ||
  !Array.isArray(routes) ||
  !routes.every(
    (route) =>
      typeof route === "object" &&
      route !== null &&
      "path" in route &&
      typeof route.path === "string" &&
      (route.path === "/" ||
        ("remote" in route && typeof route.remote === "string")),
  )
)
  throw new Error(
    "Shell project, site, remote, or route configuration is invalid",
  );
const projectName = basename(dirname(fileURLToPath(import.meta.url)));
if (process.env.NX_TASK_TARGET_PROJECT !== projectName)
  throw new Error(`${projectName} Rsbuild config must be invoked through Nx`);
const base = `${siteConfig.pagesBase}/`;
const outputRoot = `dist/apps/${projectName}`;
const routeRemotes = routes.map((route) =>
  route.path === "/" ? "home" : (route.remote as string),
);
if (!routeRemotes.every((name) => name in remoteManifest))
  throw new Error("Every shell route must reference a declared remote");
const remoteMap = (names: readonly string[]) =>
  Object.fromEntries(
    names.map((name) => [
      remoteManifest[name as keyof typeof remoteManifest],
      `${remoteManifest[name as keyof typeof remoteManifest]}@${base}remotes/${name}/remoteEntry.js`,
    ]),
  );

// llmlint: ignore[changed_behavior_has_e2e] site.spec.ts and the route-specific Playwright suites exercise every shell route and remote state through the real composed Rsbuild artifact.
export default defineConfig({
  source: {
    entry: { index: "./apps/shell/src/main.tsx" },
    tsconfigPath: "./tsconfig.base.json",
  },
  output: {
    assetPrefix: base,
    distPath: { root: outputRoot },
    cleanDistPath: true,
  },
  html: { template: "./apps/shell/src/index.html" },
  server: { port: 4200, base, cors: true },
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: projectName,
      filename: "remoteEntry.js",
      exposes: { "./App": "./apps/shell/src/app.tsx" },
      remotes: remoteMap(routeRemotes),
      shared: {
        react: { singleton: true, requiredVersion: false, eager: true },
        "react-dom": { singleton: true, requiredVersion: false, eager: true },
      },
    }),
  ],
});
