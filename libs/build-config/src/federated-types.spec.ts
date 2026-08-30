import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { rspack } from "@rspack/core";
import { afterEach, describe, expect, test } from "vitest";
import { z } from "zod";
import {
  clearFederatedTypes,
  consumeFederatedTypes,
  FederatedTypesPlugin,
  federatedTypesRoot,
  federatedTypeUrls,
  hostTypesPath,
  missingRemoteTypes,
  publishFederatedTypes,
  remoteTypesArchive,
  remoteTypesPath,
} from "./federated-types";
import { remoteRegistry } from "./remote-registry";

// Every case works in its own project, alias, and host below the same trees a
// real build writes into, so nothing here can disturb what a build published.
const project = "federated-types-spec-remote";
const alias = "federatedTypesSpecRemote";
const host = "federated-types-spec-host";
const built = resolve(`dist/apps/${project}`);
const published = resolve(remoteTypesPath(alias));
const archive = resolve(remoteTypesArchive(alias));
const consumed = resolve(hostTypesPath(host));

/**
 * An archive as Module Federation's generator writes one: the bytes below are
 * a stand-in for its contents, but they open with the ZIP local file header
 * every real archive opens with, which is the part the consumer reads.
 */
const archiveBytes = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from("Page.d.ts"),
]);

/** What a remote's declaration generator leaves behind for the publish step. */
async function generated() {
  await mkdir(join(built, "@mf-types"), { recursive: true });
  await writeFile(
    join(built, "@mf-types", "Page.d.ts"),
    "export { default } from './compiled-types/src/page';\n",
  );
  await writeFile(join(built, "@mf-types.zip"), archiveBytes);
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
      // rspack types this argument as `never` for a plugin it does not know,
      // exactly as it does for the plugin under test, so this stand-in reaches
      // processAssets the same way that one does rather than a way of its own.
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
    await writeFile(archive, archiveBytes);

    const urls = await federatedTypeUrls([alias])();

    expect(urls[alias]).toEqual({
      alias,
      api: "",
      zip: `data:application/zip;base64,${archiveBytes.toString("base64")}`,
    });
  });

  test("reports a remote whose archive was never published", async () => {
    await expect(federatedTypeUrls([alias])()).rejects.toThrow(
      `${remoteTypesArchive(alias)} does not exist`,
    );
  });

  test("reports a published file that is not an archive at all", async () => {
    await mkdir(resolve(`${remoteTypesPath(alias)}/..`), { recursive: true });
    // A truncated write, or a generator that reported an archive it never
    // finished, leaves bytes here that the downloader cannot unpack.
    await writeFile(archive, "not an archive");

    await expect(federatedTypeUrls([alias])()).rejects.toThrow(
      `${remoteTypesArchive(alias)} is not a ZIP archive`,
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

/**
 * The drift gate over the trees above. Nx restores a cached build from the
 * outputs that build declares, so an app whose `project.json` does not name
 * the declaration trees its build writes would replay as a cache hit that
 * leaves a host with nothing to typecheck against -- and those paths are
 * written out once per app, away from the module that decides them. Each one
 * is derived here from the same helpers the build calls.
 */
const buildOutputs = z.object({
  targets: z.object({ build: z.object({ outputs: z.array(z.string()) }) }),
});

describe("the declaration trees a build declares as its outputs", () => {
  test("names every tree it writes, in every app that writes one", async () => {
    const apps = (await readdir("apps", { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(apps).toContain("shell");
    for (const app of apps) {
      const alias: string | undefined =
        remoteRegistry[app as keyof typeof remoteRegistry];
      // A host is an app that federates remotes, which it declares by mapping
      // them in its own rspack configuration and nowhere else.
      const composes = (
        await readFile(`apps/${app}/rspack.config.ts`, "utf8")
      ).includes("remoteMap(");
      const owed = [
        ...(composes ? [hostTypesPath(app)] : []),
        ...(alias ? [remoteTypesPath(alias), remoteTypesArchive(alias)] : []),
      ].map((tree) => `{workspaceRoot}/${tree}`);

      const declared = buildOutputs
        .parse(JSON.parse(await readFile(`apps/${app}/project.json`, "utf8")))
        .targets.build.outputs.filter((output) =>
          output.includes(federatedTypesRoot),
        );

      expect(declared.sort(), `apps/${app}/project.json`).toEqual(owed.sort());
    }
  });
});
