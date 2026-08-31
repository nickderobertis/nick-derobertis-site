import {
  cp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import {
  defineConfig,
  type MergedEnvironmentConfig,
  type ModifyEnvironmentConfigUtils,
  type ModifyRspackConfigFn,
  type RsbuildPlugin,
} from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import {
  FederatedTypesPlugin,
  publishFragment,
  remoteExposes,
  sharedSingletons,
} from "@site/build-config";
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild";
import {
  extractStartFragment,
  rewriteStartAssetReferences,
} from "./start-output";
import { awardsPublicPath } from "./start-contract";

const outputPath = resolve("dist/apps/awards");
const publicPath = awardsPublicPath;
// Start executes the prerendered route during its synchronous hydration entry,
// before Module Federation can cross the async boundary used by conventional
// remote main entries. Its route dependencies must therefore be available
// during share-scope startup in both the standalone document and the shell.
const startSharedSingletons = Object.fromEntries(
  Object.entries(sharedSingletons).map(([name, options]) => [
    name,
    { ...options, eager: true },
  ]),
);
const exposes = remoteExposes({ skeleton: true });
const federatedTypes = new FederatedTypesPlugin({
  generates: {
    project: "awards",
    alias: "awards",
    exposes: Object.keys(exposes),
  },
});

const publishStartClient = (): RsbuildPlugin => ({
  name: "awards-publish-start-client",
  setup(api) {
    api.onBeforeBuild(async () => {
      await rm(outputPath, { force: true, recursive: true });
    });
    api.onAfterBuild(async () => {
      const clientPath = resolve(outputPath, "client");
      const emitted = await readdir(clientPath, { recursive: true });
      const initialCss = emitted.find((path) =>
        /^assets\/css\/main\.[0-9a-f]+\.css$/.test(path),
      );
      const initialJs = emitted.find((path) =>
        /^assets\/js\/index\.[0-9a-f]+\.js$/.test(path),
      );
      if (!initialCss)
        throw new Error("Start emitted no hashed Awards entry stylesheet");
      if (!initialJs)
        throw new Error("Start emitted no hashed Awards entry script");
      const publishedCss = initialCss.replace("assets/css/", "");
      const publishedJs = initialJs.replace(/^assets\/js\/index\./, "main.");
      await Promise.all([
        rename(
          resolve(clientPath, initialCss),
          resolve(clientPath, publishedCss),
        ),
        rename(
          resolve(clientPath, initialJs),
          resolve(clientPath, publishedJs),
        ),
      ]);
      const asyncCss = emitted.filter((path) =>
        /^assets\/css\/async\/main\.[0-9a-f]+\.css$/.test(path),
      );
      const asyncJs = emitted.filter((path) =>
        /^assets\/js\/async\/[^/]+\.js$/.test(path),
      );
      await Promise.all([
        ...asyncCss.map((path) =>
          rename(
            resolve(clientPath, path),
            resolve(clientPath, path.replace("/main.", "/route.")),
          ),
        ),
        ...asyncJs.map((path) =>
          rename(
            resolve(clientPath, path),
            resolve(clientPath, path.slice(path.lastIndexOf("/") + 1)),
          ),
        ),
      ]);
      for (const path of await readdir(clientPath, { recursive: true })) {
        const file = resolve(clientPath, path);
        if (!/\.(?:css|html|js|json|txt)$/.test(path)) continue;
        const metadata = await stat(file);
        if (!metadata.isFile()) continue;
        const source = await readFile(file, "utf8");
        const relocated = source
          .replaceAll(initialCss, publishedCss)
          .replaceAll(initialJs, publishedJs)
          .replaceAll("assets/css/async/main.", "assets/css/async/route.")
          .replaceAll("assets/js/async/", "");
        const updated = rewriteStartAssetReferences(relocated)
          .replaceAll('"/assets/', '"assets/')
          .replaceAll('"/main.', '"main.');
        if (updated !== source) await writeFile(file, updated);
      }
      const document = await readFile(
        resolve(clientPath, "index.html"),
        "utf8",
      );
      await publishFragment(
        "awards",
        clientPath,
        await readdir(clientPath, { recursive: true }),
        extractStartFragment(document),
        publicPath,
      );
      for (const entry of await readdir(clientPath))
        await cp(resolve(clientPath, entry), resolve(outputPath, entry), {
          recursive: true,
        });
      await Promise.all([
        rm(clientPath, { recursive: true }),
        rm(resolve(outputPath, "server"), { force: true, recursive: true }),
      ]);
    });
  },
});

export default defineConfig({
  root: resolve("apps/awards"),
  output: {
    assetPrefix: publicPath,
    cleanDistPath: true,
    distPath: { root: outputPath, css: "." },
    filename: { css: "main.[contenthash:10].css" },
  },
  plugins: [
    pluginReact(),
    tanstackStart({
      prerender: { enabled: true, crawlLinks: false },
      router: {
        basepath: "/nick-derobertis-site/remotes/awards",
        routeTreeFileHeader: [
          "// llmlint: ignore-block[suppressions_justified, comments_earn_their_place] TanStack Router owns this generated file and emits its lint, type-check, IDE, update-input escapes, and generic exclusion advice; the precise route types are completed by the declarations it generates below, and the repository deliberately checks the file despite that upstream advice.",
          "/* eslint-disable */",
          "// @ts-nocheck",
          "// noinspection JSUnusedGlobalSymbols",
        ],
        routeTreeFileFooter: [
          "// llmlint: ignore-end[suppressions_justified, comments_earn_their_place]",
        ],
      },
      srcDirectory: "start",
      rsbuild: { client: { output: "iife" } },
    }),
    pluginModuleFederation(
      {
        name: "awards",
        filename: "remoteEntry.js",
        getPublicPath: `function() { return "${publicPath}" }`,
        exposes,
        dts: {
          generateTypes: {
            abortOnError: true,
            generateAPITypes: false,
            deleteTypesFolder: false,
            tsConfigPath: "tsconfig.app.json",
            afterGenerate: () => federatedTypes.publish(),
          },
        },
        shared: startSharedSingletons,
      },
      { environment: "client" },
    ),
    {
      name: "awards-published-fragment",
      setup(api) {
        api.modifyEnvironmentConfig(
          (
            config: MergedEnvironmentConfig,
            { name }: ModifyEnvironmentConfigUtils,
          ) => {
            if (name !== "client") return;
            const addFragmentPlugin: ModifyRspackConfigFn = (rspackConfig) => {
              rspackConfig.plugins ??= [];
              rspackConfig.output.publicPath = publicPath;
              rspackConfig.plugins.push(federatedTypes);
            };
            config.tools.rspack = addFragmentPlugin;
          },
        );
      },
    },
    publishStartClient(),
  ],
});
