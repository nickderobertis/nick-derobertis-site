import { createRequire } from "node:module";

/**
 * Narrows the canonical remote registry. `remotes.json` ships in this library,
 * so this is the one grammar it is held to: every consumer that derives a
 * federation alias, a route pane, or a publish-lane subtree path reads the
 * registry through here rather than indexing the serialized file, which is why
 * a key that could not be a project name is rejected here rather than reaching
 * rspack or git.
 */
export function validatedRemoteRegistry(
  value: unknown,
): Record<string, string> {
  // llmlint: ignore[changed_behavior_has_e2e] This guard is a build-time rejection, so its only observable effect is a refused build and there is no browser render path to drive. The shape it newly refuses is a registry declaring no remote, and with no remote declared neither a standalone remote document nor a host-composed pane exists to render: the artifact a browser test would assert against is exactly what the refusal prevents from being built. remote-registry.spec.ts covers the rejection both through this function and through a real Node process loading this real module against an empty remotes.json, which is where the guard actually runs.
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length === 0 ||
    Object.entries(value).some(
      ([name, alias]) =>
        !/^[a-z][a-z-]+$/.test(name) ||
        typeof alias !== "string" ||
        !/^[a-z][A-Za-z]*$/.test(alias),
    )
  )
    throw new Error(
      "libs/build-config/src/remotes.json must map every remote's project name to a federation alias string. Fix the remote registry and rerun just check.",
    );
  // Every key and every value was just checked one by one, so this restates
  // what the guard above proved rather than assuming anything about the file.
  return value as Record<string, string>;
}

// `require` returns `any`, so the checked-in JSON's own inferred type is
// restored here and its shape is checked before anything below reads it.
const remoteManifest = createRequire(import.meta.url)(
  "./remotes.json",
) as typeof import("./remotes.json");
/* v8 ignore next -- The committed registry is validated through every consumer by just check, so only a corrupted checkout reaches this call's rejection; remote-registry.spec.ts drives that rejection through the function itself. */
validatedRemoteRegistry(remoteManifest);

/**
 * The canonical remote registry, narrowed at import. Keeping the manifest's own
 * inferred type is what lets `RemoteProject` name the remotes that exist.
 */
export const remoteRegistry = remoteManifest;

export type RemoteProject = keyof typeof remoteRegistry;
