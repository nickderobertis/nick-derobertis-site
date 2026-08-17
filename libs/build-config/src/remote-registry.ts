import { createRequire } from "node:module";

// `require` returns `any`, so the checked-in JSON's own inferred type is
// restored here and the entry shapes are validated below before any use.
const remoteManifest = createRequire(import.meta.url)(
  "./remotes.json",
) as typeof import("./remotes.json");
/* v8 ignore start -- This guard runs at import over a committed build input that just check already validates through every consumer; only a corrupted checkout reaches its rejection branch, and the named diagnostic is what makes that failure readable. */
// llmlint: ignore[changed_behavior_has_e2e] This guard rejects a malformed build input before any bundle exists, so nothing it refuses can reach a visitor and there is no browser interface to drive; rspack-remote.spec.ts covers the configuration derived from it, and every app's ownership.spec.ts drives the remote that configuration builds through both boundaries.
if (
  typeof remoteManifest !== "object" ||
  remoteManifest === null ||
  Array.isArray(remoteManifest) ||
  Object.entries(remoteManifest).some(
    ([key, value]) =>
      !/^[a-z][a-z-]+$/.test(key) ||
      typeof value !== "string" ||
      !/^[a-z][A-Za-z]*$/.test(value),
  )
)
  throw new Error("remotes.json must contain string remote-name mappings");
/* v8 ignore stop */

/**
 * The canonical remote registry, narrowed by the guard above. This is the one
 * view of `remotes.json` inside this library: nothing here reads the serialized
 * file itself, so no consumer can index a manifest whose shape was never
 * checked.
 */
export const remoteRegistry = remoteManifest;

export type RemoteProject = keyof typeof remoteRegistry;
