import { cp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
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
  PublishedFragmentPlugin,
  sharedSingletons,
} from "@site/build-config";
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild";

const outputPath = resolve("dist/apps/awards");
const publicPath = "/nick-derobertis-site/remotes/awards/";
const federatedTypes = new FederatedTypesPlugin({
  generates: {
    project: "awards",
    alias: "awards",
    exposes: ["./Page", "./Skeleton"],
  },
});

const publishStartClient = (): RsbuildPlugin => ({
  name: "awards-publish-start-client",
  setup(api) {
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
        const source = await readFile(file).catch(() => undefined);
        if (!source) continue;
        const updated = source
          .toString()
          .replaceAll(initialCss, publishedCss)
          .replaceAll(initialJs, publishedJs)
          .replaceAll("assets/css/async/main.", "assets/css/async/route.")
          .replaceAll("assets/js/async/", "")
          .replaceAll('"/assets/', '"assets/')
          .replaceAll('"/main.', '"main.');
        if (updated !== source.toString()) await writeFile(file, updated);
      }
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
    distPath: { root: outputPath, css: "." },
    filename: { css: "main.[contenthash:10].css" },
  },
  plugins: [
    pluginReact(),
    tanstackStart({
      prerender: { enabled: true, crawlLinks: false },
      router: { basepath: "/nick-derobertis-site/remotes/awards" },
      srcDirectory: "start",
      rsbuild: { client: { output: "iife" } },
    }),
    pluginModuleFederation(
      {
        name: "awards",
        filename: "remoteEntry.js",
        getPublicPath: `function() { return "${publicPath}" }`,
        exposes: {
          "./Page": "./src/page.tsx",
          "./Skeleton": "./src/skeleton.tsx",
        },
        dts: {
          generateTypes: {
            abortOnError: true,
            generateAPITypes: false,
            deleteTypesFolder: false,
            tsConfigPath: "tsconfig.app.json",
            afterGenerate: () => federatedTypes.publish(),
          },
        },
        shared: sharedSingletons,
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
              rspackConfig.plugins.push(
                new PublishedFragmentPlugin("awards"),
                federatedTypes,
              );
            };
            config.tools.rspack = addFragmentPlugin;
          },
        );
      },
    },
    publishStartClient(),
  ],
});
