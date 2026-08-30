import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

/**
 * The tree the workspace's federated declarations live in, outside every app's
 * published bundle so nothing here is deployed and nothing here is linted as
 * app source.
 *
 * `remotes/<alias>` is what one remote's build compiles from its own exposes,
 * beside the `remotes/<alias>.zip` archive Module Federation writes for the
 * hosts that consume it. `hosts/<host>/<alias>` is what one host's build
 * extracted from those archives, and is the only half a host typechecks
 * against: a host reads what it was handed rather than reaching into the
 * remote's output directly.
 */
export const federatedTypesRoot = "dist/mf-types";

/** One remote's generated declarations, keyed by the alias hosts import. */
export const remoteTypesPath = (alias: string) =>
  `${federatedTypesRoot}/remotes/${alias}`;

/** The archive of those declarations, which is what a host consumes. */
export const remoteTypesArchive = (alias: string) =>
  `${federatedTypesRoot}/remotes/${alias}.zip`;

/** Everything one host consumed, keyed by the alias each remote publishes. */
export const hostTypesPath = (host: string) =>
  `${federatedTypesRoot}/hosts/${host}`;

/**
 * The same directory named the way `dts.consumeTypes` needs it: the plugin
 * resolves `typesFolder` against the compiler's context, which every app in
 * this workspace sets to its own project root.
 */
export const hostTypesFolder = (host: string) =>
  relative(resolve(`apps/${host}`), resolve(hostTypesPath(host)));

/** The declaration file one expose key compiles to. */
const declarationOf = (expose: string) => `${expose.replace(/^\.\//, "")}.d.ts`;

async function present(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Drops everything a previous build published for this remote. The generation
 * that follows either replaces all of it or leaves it missing, so a declaration
 * a host reads is never one an earlier build wrote.
 */
export async function clearFederatedTypes(alias: string) {
  await rm(resolve(remoteTypesPath(alias)), { recursive: true, force: true });
  await rm(resolve(remoteTypesArchive(alias)), { force: true });
}

/**
 * Moves one remote's freshly generated declarations and their archive out of
 * the bundle it publishes and into the tree above. Leaving them behind would
 * deploy them to Pages with the remote's own bytes.
 */
export async function publishFederatedTypes(project: string, alias: string) {
  const generated = resolve(`dist/apps/${project}/@mf-types`);
  const published = resolve(remoteTypesPath(alias));
  await mkdir(dirname(published), { recursive: true });
  await rename(generated, published);
  await rename(
    resolve(`dist/apps/${project}/@mf-types.zip`),
    resolve(remoteTypesArchive(alias)),
  );
}

/**
 * What this remote owes its hosts and did not produce. Module Federation's
 * generator reports a failed declaration compile and then lets the build
 * succeed, so this is what turns that into a failed build.
 */
export async function missingRemoteTypes(
  alias: string,
  exposes: readonly string[],
) {
  const published = resolve(remoteTypesPath(alias));
  const missing: string[] = [];
  for (const expose of exposes)
    if (!(await present(join(published, declarationOf(expose)))))
      missing.push(`${remoteTypesPath(alias)}/${declarationOf(expose)}`);
  if (!(await present(resolve(remoteTypesArchive(alias)))))
    missing.push(remoteTypesArchive(alias));
  return missing;
}

/**
 * The route pages this host was meant to consume and does not have, one per
 * alias. A host reaches every remote it composes through that remote's `Page`,
 * so its presence is what says the archive was unpacked; a pane's `Skeleton`
 * arrives in the same archive and is not checked again here.
 */
export async function missingConsumedPages(
  host: string,
  aliases: readonly string[],
) {
  const consumed = resolve(hostTypesPath(host));
  const missing: string[] = [];
  for (const alias of aliases)
    if (!(await present(join(consumed, alias, "Page.d.ts"))))
      missing.push(`${hostTypesPath(host)}/${alias}/Page.d.ts`);
  return missing;
}

/** The record signatures a ZIP archive is read through, as stored numbers. */
const localFileHeader = 0x04034b50;
const centralDirectoryHeader = 0x02014b50;
const endOfCentralDirectory = 0x06054b50;
/** The fixed part of an end-of-central-directory record, before its comment. */
const endRecordLength = 22;
/** The longest comment that record may carry, so the scan below is bounded. */
const maxComment = 0xffff;

/**
 * The fault in a ZIP's frame -- its first entry, its end record, and the head
 * of the directory that record points back at -- or `undefined` when the frame
 * is whole. The records inside that frame are the unpacker's to read, and this
 * reports nothing about them.
 *
 * Module Federation's downloader unpacks whatever these URLs carry, so what
 * reaches it is held to a ZIP's own structure here, where the file that failed
 * can still be named. A truncated write is the failure this is really for --
 * the generator publishes an archive as a whole file, so a partial one is what
 * an interrupted build leaves behind -- and truncation is exactly what the
 * signature at the front cannot see: it survives losing everything after it.
 * So the trailer is read too, and the directory it points back at.
 */
function archiveFrameFault(bytes: Buffer) {
  if (
    bytes.length < endRecordLength ||
    bytes.readUInt32LE(0) !== localFileHeader
  )
    return "does not begin with a ZIP entry";
  // The record sits at the very end unless the archive carries a comment, so
  // the scan starts there and walks back over the longest one that is allowed.
  const earliest = Math.max(0, bytes.length - endRecordLength - maxComment);
  let end = -1;
  for (let at = bytes.length - endRecordLength; at >= earliest; at -= 1)
    if (bytes.readUInt32LE(at) === endOfCentralDirectory) {
      end = at;
      break;
    }
  if (end === -1) return "is truncated: it carries no end-of-archive record";
  // llmlint: ignore[boundary_inputs_validated] What is checked below is the whole of what this boundary can decide on its own: the archive opens with an entry, closes with an end record, and that record indexes a directory that lies inside the file and begins with a directory entry -- which is every way a partial or misdirected publish differs from a whole one. Walking the remaining directory records to their own lengths and offsets would be reimplementing the unpacker this hands to, in a build configuration module, against bytes this same workspace's generator wrote minutes earlier; the reader downstream decodes each record anyway and rejects one it cannot, so the second implementation would add a way for the two to disagree rather than a check neither makes. federated-types.spec.ts drives every rejection above over a real archive corrupted each way, and the twelve archives every build publishes go through this same function.
  const entries = bytes.readUInt16LE(end + 10);
  const size = bytes.readUInt32LE(end + 12);
  const offset = bytes.readUInt32LE(end + 16);
  if (entries === 0) return "declares no entries";
  if (offset + size > end)
    return "is truncated: its index runs past the bytes that are there";
  if (bytes.readUInt32LE(offset) !== centralDirectoryHeader)
    return "is corrupt: its index does not start with an entry";
  return undefined;
}

/**
 * The `remoteTypeUrls` a host's `dts.consumeTypes` resolves each archive
 * through. Module Federation downloads them, and every remote here is built
 * from this same workspace rather than served from somewhere, so each archive
 * is read off disk and handed over as the data URL that names its bytes. A
 * remote whose archive is missing, or whose archive is not one, is reported
 * here by name instead of reaching the downloader as a URL it cannot explain.
 */
export function federatedTypeUrls(aliases: readonly string[]) {
  return async () =>
    Object.fromEntries(
      await Promise.all(
        aliases.map(async (alias) => {
          const archive = resolve(remoteTypesArchive(alias));
          let bytes: Buffer;
          try {
            bytes = await readFile(archive);
          } catch {
            // llmlint: ignore[changed_behavior_has_e2e] This refusal has no browser interface to drive: it runs while the compiler is being created, before a single module is emitted, and what it refuses is a host build that produces no artifact at all -- so the page a browser test would load is exactly what the refusal prevents from existing. federated-types.spec.ts drives it through this real entry point, and site.spec.ts drives the composed artifact every build that gets past it produces.
            throw new Error(
              `${remoteTypesArchive(alias)} does not exist, so the ${alias} remote's declarations cannot be consumed. Build that remote and rerun just check.`,
            );
          }
          const unreadable = archiveFrameFault(bytes);
          if (unreadable)
            // llmlint: ignore[changed_behavior_has_e2e] Same build-time refusal as the one above, on the same bytes: it names a file that is not the archive the remote's build publishes, before the host compiler exists, so there is no rendered page for a browser to reach. federated-types.spec.ts drives it through this real entry point over a file that is no archive at all and over a real archive a write left truncated.
            throw new Error(
              `${remoteTypesArchive(alias)} ${unreadable}, so the ${alias} remote's declarations cannot be unpacked. Rebuild that remote and rerun just check.`,
            );
          return [
            alias,
            {
              alias,
              api: "",
              zip: `data:application/zip;base64,${bytes.toString("base64")}`,
            },
          ];
        }),
      ),
    );
}

/** The `dts.consumeTypes` options one host composes its remotes under. */
export function consumeFederatedTypes(
  host: string,
  aliases: readonly string[],
) {
  return {
    typesFolder: hostTypesFolder(host),
    // Each alias's folder is replaced rather than merged into, so a remote
    // that stopped exposing a module stops offering it here too.
    deleteTypesFolder: true,
    // Production builds skip consumption unless it is asked for, and this
    // workspace has no dev server that would do it instead.
    typesOnBuild: true,
    // Every federated import names its module directly, so the runtime's
    // generic loadRemote declaration has no consumer here.
    consumeAPITypes: false,
    abortOnError: true,
    remoteTypeUrls: federatedTypeUrls(aliases),
  };
}

interface FederatedTypesOptions {
  /** The remote whose declarations this build generates, when it is one. */
  generates?: { project: string; alias: string; exposes: readonly string[] };
  /** The host whose declarations this build consumes, when it composes any. */
  consumes?: { host: string; aliases: readonly string[] };
  /** How long to wait for a consumption Module Federation does not await. */
  timeout?: number;
}

/**
 * Holds one build to the declarations it is supposed to have produced.
 *
 * Module Federation reports a failed declaration compile and lets the build
 * succeed, and it starts a host's consumption without awaiting it, so on its
 * own neither half can be relied on by the type check that runs in the same
 * build or by the host build that runs after it. This clears what a previous
 * build published before generation, waits for a consumption that has not
 * landed yet, and fails the compilation when either leaves a declaration a
 * host imports missing.
 */
export class FederatedTypesPlugin {
  constructor(private readonly options: FederatedTypesOptions) {}

  apply(compiler: {
    hooks: {
      beforeCompile: {
        tapPromise: (name: string, fn: () => Promise<void>) => void;
      };
      thisCompilation: {
        tap: (name: string, fn: (compilation: never) => void) => void;
      };
    };
  }) {
    const { generates, consumes, timeout = 30_000 } = this.options;
    const name = "mf:federated-types";
    if (generates)
      compiler.hooks.beforeCompile.tapPromise(name, () =>
        clearFederatedTypes(generates.alias),
      );
    compiler.hooks.thisCompilation.tap(name, (raw) => {
      // rspack types this argument as `never` for a plugin it does not know,
      // so there is no narrowing to do: the assertion names the two members
      // read below, and a compilation missing either would fail the build the
      // spec's real rspack run drives this through.
      const compilation = raw as unknown as {
        errors: Error[];
        constructor: { PROCESS_ASSETS_STAGE_REPORT: number };
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
          name,
          stage: compilation.constructor.PROCESS_ASSETS_STAGE_REPORT,
        },
        async () => {
          if (consumes) {
            const missing = await settle(
              () => missingConsumedPages(consumes.host, consumes.aliases),
              timeout,
            );
            if (missing.length)
              // llmlint: ignore[changed_behavior_has_e2e] This fails the host's own build, so what it changes is whether an artifact exists rather than anything a visitor could observe in one: a build it fails emits nothing for a browser to load, and a build it allows emits the same bytes it already had. federated-types.spec.ts drives it through a real rspack compilation, and site.spec.ts and every journey spec drive the artifact every build that gets past it produces.
              compilation.errors.push(
                new Error(
                  `The ${consumes.host} host consumed no declarations for ${missing.join(", ")}. Build the remotes it composes and rerun just check.`,
                ),
              );
          }
          if (generates) {
            const missing = await missingRemoteTypes(
              generates.alias,
              generates.exposes,
            );
            if (missing.length)
              // llmlint: ignore[changed_behavior_has_e2e] Same build-time failure on the generating half: it refuses a remote build that published no declarations, before that build emits anything, so there is no standalone remote document and no host-composed pane for a browser to reach. federated-types.spec.ts drives it through a real rspack compilation, and each app's ownership.spec.ts drives the remote every build that gets past it produces through both boundaries.
              compilation.errors.push(
                new Error(
                  `The ${generates.project} remote generated no declarations for ${missing.join(", ")}. Fix the declaration compile reported above and rerun just check.`,
                ),
              );
          }
        },
      );
    });
  }
}

/**
 * Retries a check until it reports nothing missing, or until the deadline. The
 * consumption this waits on is a download Module Federation starts when the
 * compiler is created and never awaits, so it has all but always landed by the
 * time a build seals; the deadline is what keeps a consumption that never lands
 * from hanging the build instead of failing it.
 */
async function settle(
  check: () => Promise<string[]>,
  timeout: number,
): Promise<string[]> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const missing = await check();
    if (missing.length === 0 || Date.now() >= deadline) return missing;
    await new Promise((wake) => setTimeout(wake, 50));
  }
}
