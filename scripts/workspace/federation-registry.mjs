import { existsSync, readdirSync, readFileSync } from "node:fs";

/**
 * A federated remote is defined by its own project, and nowhere else.
 *
 * `metadata.federation.alias` is the container name Module Federation builds it
 * under, and `metadata.boundaries.onlyDependOnLibsWithTags` is the library tags
 * its `scope:` module boundary admits. Everything that used to restate one of
 * those facts in a root file — `libs/build-config/src/remotes.json`, the
 * `screenshot` and `prerender` task dependencies, and the `scope:<app>`
 * constraints in `eslint.config.mjs` — is derived from here instead, so adding
 * a remote is one edit inside the remote rather than four that have to agree.
 *
 * Two callers read a project configuration into this module — an Nx plugin
 * reading `project.json` files and a CLI reading the resolved project graph —
 * and both arrive through `declaredProject`, which is the one boundary where an
 * arbitrary JSON document becomes the narrow record everything below trusts.
 *
 * The grammars are the ones the derived consumers are held to: a remote's name
 * becomes a content-store subtree path and a directory in the served artifact,
 * an alias becomes a federation container name, and a tag reaches
 * `@nx/enforce-module-boundaries`. Each is checked here, once, rather than by
 * every consumer downstream. A project that federates nothing is only ever an
 * Nx project name, so it is held to the wider grammar.
 */

const projectName = /^[a-z][a-z0-9-]*$/;
const remoteName = /^[a-z][a-z-]+$/;
const federationAlias = /^[a-z][A-Za-z]*$/;
const libraryTag = /^[a-z][a-z-]*:[a-z][a-z0-9-]*$/;
const targetName = /^[a-z][a-z0-9-]*$/;

/**
 * The two grammars a serialized registry's own keys and values are held to, for
 * a caller reading back what `remoteRegistry` wrote. They are published rather
 * than restated there, so the file this module derives is narrowed on the way
 * in by the same rules it was narrowed by on the way out.
 */
export const remoteGrammar = Object.freeze({ remoteName, federationAlias });

function reject(source, reason) {
  throw new Error(
    `${source} ${reason}. Fix that project's declaration and rerun just check.`,
  );
}

/**
 * One project narrowed to what this module's consumers actually read: its Nx
 * project name, the metadata a remote declares itself through, and the names of
 * the targets it declares. Nothing else from the document survives, so no
 * consumer can reach a field this boundary did not check.
 */
export function declaredProject(configuration, source) {
  if (typeof configuration !== "object" || configuration === null)
    reject(source, "is not an Nx project configuration object");
  const { name, metadata, tags, targets } = configuration;
  if (typeof name !== "string" || !projectName.test(name))
    reject(source, "declares no Nx project name");
  if (
    metadata !== undefined &&
    (typeof metadata !== "object" || metadata === null)
  )
    reject(source, "declares a metadata that is not an object");
  if (
    tags !== undefined &&
    (!Array.isArray(tags) ||
      tags.some((tag) => typeof tag !== "string" || !libraryTag.test(tag)))
  )
    reject(source, "declares a tags that is not a list of Nx tags");
  if (
    targets !== undefined &&
    (typeof targets !== "object" || targets === null)
  )
    reject(source, "declares a targets that is not an object");
  const declaredTargets = Object.keys(targets ?? {});
  if (declaredTargets.some((target) => !targetName.test(target)))
    reject(source, "declares a target that could not be an Nx target name");
  return {
    name,
    metadata,
    tags: [...(tags ?? [])],
    targets: declaredTargets,
    source,
  };
}

/** The same narrowing, for a project read straight off disk. */
export function readDeclaredProject(path) {
  let document;
  try {
    document = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    // eslint and the Nx plugin both enter here, and a bare parser or filesystem
    // diagnostic reaches them naming neither the file nor what to do about it.
    reject(
      path,
      `could not be read as JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return declaredProject(document, path);
}

/**
 * The federation declaration one project makes, or `undefined` when it makes
 * none — which is what tells a host like the shell apart from a remote.
 */
export function federationDeclaration({ name, metadata, tags, source }) {
  const federation = metadata?.federation;
  if (federation === undefined) return undefined;
  if (typeof federation !== "object" || federation === null)
    reject(source, "declares a metadata.federation that is not an object");
  if (!remoteName.test(name))
    reject(
      source,
      `declares a federated remote named "${name}", which could not be an Nx project or a content-store subtree path`,
    );
  const { alias } = federation;
  if (typeof alias !== "string" || !federationAlias.test(alias))
    reject(
      source,
      `declares the federation alias ${JSON.stringify(alias)}, which could not be a Module Federation container name`,
    );
  const admitted = metadata?.boundaries?.onlyDependOnLibsWithTags;
  if (
    !Array.isArray(admitted) ||
    admitted.length === 0 ||
    admitted.some((tag) => typeof tag !== "string" || !libraryTag.test(tag))
  )
    reject(
      source,
      "declares no metadata.boundaries.onlyDependOnLibsWithTags list of Nx tags, which is what its scope: module boundary is built from",
    );
  // The constraint below is published for scope:<name>, and Nx applies a
  // constraint only to projects carrying its source tag, so a remote that does
  // not tag itself that way would get a boundary that silently matches nothing.
  // The tag is the remote's to declare, so it is checked against the remote
  // rather than restated here.
  if (!tags.includes(`scope:${name}`))
    reject(
      source,
      `declares the tags ${JSON.stringify(tags)}, none of which is the scope:${name} tag its module boundary would constrain`,
    );
  return { name, alias, onlyDependOnLibsWithTags: [...admitted] };
}

/**
 * Every remote the workspace declares, ordered by project name so that what is
 * derived from them does not depend on the order projects were discovered in.
 */
export function federationRemotes(projects) {
  const remotes = projects
    .map((project) => federationDeclaration(project))
    .filter((remote) => remote !== undefined)
    .sort((one, other) => one.name.localeCompare(other.name));
  if (remotes.length === 0)
    throw new Error(
      "No project declares metadata.federation.alias, so the workspace federates nothing. Declare a remote's alias in its own project.json and rerun just check.",
    );
  const claimedBy = new Map();
  for (const remote of remotes) {
    const claimed = claimedBy.get(remote.alias);
    if (claimed !== undefined)
      throw new Error(
        `${claimed} and ${remote.name} both declare the federation alias "${remote.alias}", so one container would overwrite the other. Give each remote its own alias and rerun just check.`,
      );
    claimedBy.set(remote.alias, remote.name);
  }
  return remotes;
}

/**
 * The canonical remote registry: each remote's project name mapped to the
 * federation alias it publishes under. This is the fact
 * `libs/build-config/src/remotes.json` serializes.
 */
export function remoteRegistry(remotes) {
  return Object.fromEntries(remotes.map(({ name, alias }) => [name, alias]));
}

/**
 * The `@nx/enforce-module-boundaries` constraint each remote declares for its
 * own `scope:` tag.
 */
export function moduleBoundaryConstraints(remotes) {
  return remotes.map(({ name, onlyDependOnLibsWithTags }) => ({
    sourceTag: `scope:${name}`,
    onlyDependOnLibsWithTags,
  }));
}

/**
 * Every app project, read straight from disk. `eslint.config.mjs` resolves its
 * boundary constraints through this: the eslint run is one of the things the
 * project graph is built for, so it cannot wait on one being built.
 */
export function declaredAppProjects(root = "apps") {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${root}/${entry.name}/project.json`)
    .filter((path) => existsSync(path))
    .sort()
    .map(readDeclaredProject);
}
