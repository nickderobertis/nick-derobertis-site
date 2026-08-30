import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { crc32 } from "node:zlib";
import { rspack } from "@rspack/core";
import { afterEach, describe, expect, test } from "vitest";
import { z } from "zod";
import {
  clearFederatedTypes,
  consumeFederatedTypes,
  FederatedTypesPlugin,
  federatedTypesRoot,
  federatedTypeUrls,
  hostTypesFolder,
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
// Where the compilations below are pointed instead. It sits under `dist` for
// the same reason every real build's output does: publishing is a rename, and
// a rename cannot cross a filesystem, so a build writing to the system's
// temporary directory could never publish into this repository's tree.
const elsewhere = resolve("dist/build-config/federated-types-spec");
const published = resolve(remoteTypesPath(alias));
const archive = resolve(remoteTypesArchive(alias));
const consumed = resolve(hostTypesPath(host));

/**
 * A real ZIP archive holding one stored entry, which is what the generator
 * publishes and what the consumer reads: the entry, the central directory
 * indexing it, and the end record a reader finds that directory through.
 * Building it here is what lets the corruptions below be real ones.
 */
function zipArchive(name: string, contents: string) {
  const named = Buffer.from(name);
  const stored = Buffer.from(contents);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc32(stored), 14);
  local.writeUInt32LE(stored.length, 18);
  local.writeUInt32LE(stored.length, 22);
  local.writeUInt16LE(named.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc32(stored), 16);
  central.writeUInt32LE(stored.length, 20);
  central.writeUInt32LE(stored.length, 24);
  central.writeUInt16LE(named.length, 28);
  const entry = Buffer.concat([local, named, stored]);
  const index = Buffer.concat([central, named]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(index.length, 12);
  end.writeUInt32LE(entry.length, 16);
  return Buffer.concat([entry, index, end]);
}

const declaration = "export { default } from './compiled-types/src/page';\n";
const archiveBytes = zipArchive("Page.d.ts", declaration);

/** That archive with one field of its end record rewritten in place. */
function edited(rewrite: (zip: Buffer, end: number) => void) {
  const copy = Buffer.from(archiveBytes);
  rewrite(copy, copy.length - 22);
  return copy;
}

/**
 * What a remote's declaration generator leaves behind for the publish step,
 * written where that generator writes it: below the output directory of the
 * build that ran it, whatever directory that build was pointed at.
 */
async function generated(outputPath: string) {
  await mkdir(join(outputPath, "@mf-types"), { recursive: true });
  await writeFile(join(outputPath, "@mf-types", "Page.d.ts"), declaration);
  await writeFile(join(outputPath, "@mf-types.zip"), archiveBytes);
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
    output: { path: join(elsewhere, "out") },
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

/**
 * A stand-in generator: the real publish step, run where the real one runs and
 * handed the result the way a remote's configuration hands it over, through
 * the plugin's own `afterGenerate` hook. It writes into the output directory
 * of the build it is applied to, because that is the only directory Module
 * Federation's generator ever writes into -- a build pointed somewhere other
 * than `dist/apps/<project>` generates its declarations there too.
 */
function publishesDuringBuild(plugin: FederatedTypesPlugin) {
  return {
    apply(compiler: {
      options: { output: { path?: string } };
      hooks: {
        thisCompilation: {
          tap: (name: string, fn: (c: never) => void) => void;
        };
      };
    }) {
      const outputPath = compiler.options.output.path;
      if (outputPath === undefined)
        throw new Error("this compilation must declare an output directory");
      compiler.hooks.thisCompilation.tap("spec:generate", (raw) => {
        // rspack types this argument as `never` for a plugin it does not know,
        // exactly as it does for the plugin under test, so this stand-in
        // reaches processAssets the same way that one does rather than a way
        // of its own.
        // llmlint: ignore[suppressions_justified] The escape is necessary for the same reason it is in the plugin under test: rspack declares this hook's argument as `never` for a plugin outside its own Plugin union, and `never` admits no property access and no type guard, so there is nothing to narrow from. It is deliberately the same shape as the one in federated-types.ts -- if this stand-in reached processAssets some typed way of its own, it would stop being the generator the plugin really runs beside.
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
            stage:
              compilation.constructor.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
          },
          async () => {
            await generated(outputPath);
            await plugin.publish();
          },
        );
      });
    },
  };
}

afterEach(async () => {
  await rm(built, { recursive: true, force: true });
  await rm(elsewhere, { recursive: true, force: true });
  await rm(published, { recursive: true, force: true });
  await rm(archive, { force: true });
  await rm(consumed, { recursive: true, force: true });
});

describe("a remote's published declarations", () => {
  test("moves what was generated out of the bundle the remote publishes", async () => {
    await generated(built);

    await publishFederatedTypes(built, alias);

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
    const plugin = new FederatedTypesPlugin({
      generates: { project, alias, exposes: ["./Page"] },
    });

    // `compile` builds into a throwaway directory of its own rather than into
    // `dist/apps/<project>`, which is what a spec compiling a remote's real
    // configuration does too, so this also holds the publish step to the
    // directory the build wrote in rather than one named after the project.
    const errors = await compile(plugin, publishesDuringBuild(plugin));

    expect(errors).toEqual([]);
    expect(await readdir(published)).toEqual(["Page.d.ts"]);
    // Nothing was taken from the tree a build pointed elsewhere never wrote.
    await expect(readdir(built)).rejects.toThrow("ENOENT");
  });

  test("refuses to publish for a build it was never applied to", async () => {
    const plugin = new FederatedTypesPlugin({
      generates: { project, alias, exposes: ["./Page"] },
    });

    await expect(plugin.publish()).rejects.toThrow(
      `The ${project} remote generated declarations for a build this plugin was never applied to`,
    );
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

  // Each of these is what an interrupted or misdirected publish leaves on
  // disk, and every one of them would otherwise reach Module Federation's
  // downloader as a URL it could only fail on, naming nothing to act on.
  test.each([
    {
      name: "a file that is no archive at all",
      published: Buffer.from("nothing"),
      reason: "does not begin with a ZIP entry",
    },
    {
      name: "a file long enough to have been one",
      published: Buffer.alloc(64),
      reason: "does not begin with a ZIP entry",
    },
    {
      name: "an archive truncated to its first entry",
      published: archiveBytes.subarray(0, 40),
      reason: "is truncated: it carries no end-of-archive record",
    },
    {
      name: "an archive declaring no entries",
      published: edited((zip, end) => zip.writeUInt16LE(0, end + 10)),
      reason: "declares no entries",
    },
    {
      name: "an archive whose index runs past its bytes",
      published: edited((zip, end) => zip.writeUInt32LE(end, end + 12)),
      reason: "is truncated: its index runs past the bytes that are there",
    },
    {
      name: "an archive whose index is not one",
      published: edited((zip, end) => zip.writeUInt32LE(4, end + 16)),
      reason: "is corrupt: its index does not start with an entry",
    },
  ])("reports $name", async ({ published, reason }) => {
    await mkdir(resolve(`${remoteTypesPath(alias)}/..`), { recursive: true });
    await writeFile(archive, published);

    await expect(federatedTypeUrls([alias])()).rejects.toThrow(
      `${remoteTypesArchive(alias)} ${reason}`,
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
    // llmlint: ignore-block[boundary_inputs_validated] The listing this loop walks is this repository's own `apps` directory, read from the checkout the test runs in, so its entries are the committed project directories rather than anything external. Each one is validated by use rather than ahead of it, which is the whole point of the gate: a name with no `project.json`, no `rspack.config.ts`, or no `tsconfig.app.json` fails the read and fails this test, and a `project.json` that does parse is held to `buildOutputs` -- a zod schema -- before a field of it is read. Validating the names first would only replace those failures with a narrower list this test would then have to be kept in step with.
    for (const app of apps) {
      // The registry is typed by the remotes it names, and a directory listing
      // is not: the shell is an app the registry has no key for, which is the
      // case this indexing is here to report as `undefined` rather than
      // exclude. The annotation above admits that, which the index signature
      // on its own does not.
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
      if (!composes) continue;

      // A host's typecheck resolves its federated imports through the same two
      // trees, named relative to its own project root because that is where
      // its tsconfig sits. Those are restated in a file TypeScript reads and
      // this module never does, so a tree renamed here without being renamed
      // there would leave the typecheck resolving nothing -- and resolving
      // nothing is what a `paths` entry reports as no error at all.
      const configuration = await readFile(
        `apps/${app}/tsconfig.app.json`,
        "utf8",
      );
      for (const tree of [
        hostTypesFolder(app),
        relative(
          resolve(`apps/${app}`),
          resolve(`${federatedTypesRoot}/remotes`),
        ),
      ])
        expect(configuration, `apps/${app}/tsconfig.app.json`).toContain(
          `"${tree}/*"`,
        );
    }
    // llmlint: ignore-end[boundary_inputs_validated]
  });
});
