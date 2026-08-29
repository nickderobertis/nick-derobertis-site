import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { rspack } from "@rspack/core";
import { afterEach, describe, expect, test } from "vitest";
import {
  clearFederatedTypes,
  consumeFederatedTypes,
  FederatedTypesPlugin,
  federatedTypeUrls,
  hostTypesPath,
  missingRemoteTypes,
  publishFederatedTypes,
  remoteTypesArchive,
  remoteTypesPath,
} from "./federated-types";

// Every case works in its own project, alias, and host below the same trees a
// real build writes into, so nothing here can disturb what a build published.
const project = "federated-types-spec-remote";
const alias = "federatedTypesSpecRemote";
const host = "federated-types-spec-host";
const built = resolve(`dist/apps/${project}`);
const published = resolve(remoteTypesPath(alias));
const archive = resolve(remoteTypesArchive(alias));
const consumed = resolve(hostTypesPath(host));

/** What a remote's declaration generator leaves behind for the publish step. */
async function generated() {
  await mkdir(join(built, "@mf-types"), { recursive: true });
  await writeFile(
    join(built, "@mf-types", "Page.d.ts"),
    "export { default } from './compiled-types/src/page';\n",
  );
  await writeFile(join(built, "@mf-types.zip"), "archive");
}

/**
 * Runs a real rspack build over a throwaway entry with these plugins applied,
 * and reports the errors it finished with. The plugin under test decides a
 * build's outcome, so it is driven through a compilation rather than called.
 */
async function compile(...plugins: unknown[]) {
  const context = await mkdtemp(join(tmpdir(), "federated-types-"));
  await writeFile(join(context, "main.js"), "export const built = true;\n");
  const compiler = rspack({
    mode: "production",
    context,
    entry: "./main.js",
    output: { path: join(context, "out") },
    // biome-ignore lint/suspicious/noExplicitAny: rspack types its plugin list against its own Plugin union, which the plugin under test is not declared as.
    plugins: plugins as any,
  });
  try {
    return await new Promise<string[]>((settled, failed) => {
      compiler.run((error, stats) => {
        compiler.close(() => {
          if (error) failed(error);
          else
            settled(
              (stats?.toJson({ errors: true }).errors ?? []).map(
                (reported) => reported.message,
              ),
            );
        });
      });
    });
  } finally {
    await rm(context, { recursive: true, force: true });
  }
}

/** A stand-in generator: the real publish step, run where the real one runs. */
const publishesDuringBuild = {
  apply(compiler: {
    hooks: {
      thisCompilation: { tap: (name: string, fn: (c: never) => void) => void };
    };
  }) {
    compiler.hooks.thisCompilation.tap("spec:generate", (raw) => {
      const compilation = raw as unknown as {
        constructor: { PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER: number };
        hooks: {
          processAssets: {
            tapPromise: (
              options: { name: string; stage: number },
              fn: () => Promise<void>,
            ) => void;
          };
        };
      };
      compilation.hooks.processAssets.tapPromise(
        {
          name: "spec:generate",
          stage: compilation.constructor.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
        },
        async () => {
          await generated();
          await publishFederatedTypes(project, alias);
        },
      );
    });
  },
};

afterEach(async () => {
  await rm(built, { recursive: true, force: true });
  await rm(published, { recursive: true, force: true });
  await rm(archive, { force: true });
  await rm(consumed, { recursive: true, force: true });
});

describe("a remote's published declarations", () => {
  test("moves what was generated out of the bundle the remote publishes", async () => {
    await generated();

    await publishFederatedTypes(project, alias);

    expect(await readdir(published)).toEqual(["Page.d.ts"]);
    // Nothing a host reads is left in the bytes Pages serves for this remote.
    expect(await readdir(built)).toEqual([]);
    expect(await missingRemoteTypes(alias, ["./Page"])).toEqual([]);
  });

  test("reports every declaration and archive a generation did not write", async () => {
    expect(await missingRemoteTypes(alias, ["./Page", "./Skeleton"])).toEqual([
      `${remoteTypesPath(alias)}/Page.d.ts`,
      `${remoteTypesPath(alias)}/Skeleton.d.ts`,
      remoteTypesArchive(alias),
    ]);
  });

  test("drops what an earlier build published before a new one runs", async () => {
    await mkdir(published, { recursive: true });
    await writeFile(join(published, "Skeleton.d.ts"), "stale");
    await writeFile(archive, "stale");

    await clearFederatedTypes(alias);

    expect(await missingRemoteTypes(alias, ["./Page"])).toEqual([
      `${remoteTypesPath(alias)}/Page.d.ts`,
      remoteTypesArchive(alias),
    ]);
  });
});

describe("a build held to the declarations it owes", () => {
  test("replaces what an earlier build published rather than merging into it", async () => {
    await mkdir(published, { recursive: true });
    await writeFile(
      join(published, "Skeleton.d.ts"),
      "an expose since removed",
    );

    const errors = await compile(
      new FederatedTypesPlugin({
        generates: { project, alias, exposes: ["./Page"] },
      }),
      publishesDuringBuild,
    );

    expect(errors).toEqual([]);
    expect(await readdir(published)).toEqual(["Page.d.ts"]);
  });

  test("fails when the declaration generator produced nothing", async () => {
    const errors = await compile(
      new FederatedTypesPlugin({
        generates: { project, alias, exposes: ["./Page"] },
      }),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(
      `The ${project} remote generated no declarations for ${remoteTypesPath(alias)}/Page.d.ts`,
    );
  });

  test("fails when nothing was consumed for a remote the host composes", async () => {
    const errors = await compile(
      new FederatedTypesPlugin({
        consumes: { host, aliases: [alias] },
        timeout: 100,
      }),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(
      `The ${host} host consumed no declarations for ${hostTypesPath(host)}/${alias}/Page.d.ts`,
    );
  });

  test("passes once every remote the host composes has been consumed", async () => {
    await mkdir(join(consumed, alias), { recursive: true });
    await writeFile(join(consumed, alias, "Page.d.ts"), "export {};");

    expect(
      await compile(
        new FederatedTypesPlugin({
          consumes: { host, aliases: [alias] },
          timeout: 100,
        }),
      ),
    ).toEqual([]);
  });
});

describe("the archives a host consumes", () => {
  test("names each remote's archive as the bytes the downloader reads", async () => {
    await mkdir(resolve(`${remoteTypesPath(alias)}/..`), { recursive: true });
    await writeFile(archive, "archive bytes");

    const urls = await federatedTypeUrls([alias])();

    expect(urls[alias]).toEqual({
      alias,
      api: "",
      zip: `data:application/zip;base64,${Buffer.from("archive bytes").toString("base64")}`,
    });
  });

  test("reports a remote whose archive was never published", async () => {
    await expect(federatedTypeUrls([alias])()).rejects.toThrow(
      `${remoteTypesArchive(alias)} does not exist`,
    );
  });

  test("consumes into the host's own directory, named from its project root", () => {
    expect(consumeFederatedTypes(host, [alias])).toMatchObject({
      typesFolder: `../../${hostTypesPath(host)}`,
      deleteTypesFolder: true,
      typesOnBuild: true,
      consumeAPITypes: false,
    });
  });
});
