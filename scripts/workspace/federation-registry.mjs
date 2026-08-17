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
 * The grammars below are the ones the derived consumers are held to: a project
 * name becomes a content-store subtree path and an Nx project, an alias becomes
 * a federation container name, and a tag reaches `@nx/enforce-module-boundaries`.
 * Each is checked here, once, rather than by every consumer downstream.
 */

const remoteName = /^[a-z][a-z-]+$/;
const federationAlias = /^[a-z][A-Za-z]*$/;
const libraryTag = /^[a-z][a-z-]*:[a-z][a-z0-9-]*$/;

/** One remote as its own project declares it. */
/** @typedef {{ name: string, alias: string, onlyDependOnLibsWithTags: string[] }} FederationRemote */

/** A project as either the Nx project graph or a `project.json` file gives it. */
/** @typedef {{ name: string, configuration: Record<string, unknown>, source: string }} DeclaredProject */

function reject(source, reason) {
  throw new Error(
    `${source} ${reason}. Fix that project's federation declaration and rerun just check.`,
  );
}

/**
 * The federation declaration one project makes, or `undefined` when it makes
 * none — which is what tells a host like the shell apart from a remote.
 *
 * @param {DeclaredProject} project
 * @returns {FederationRemote | undefined}
 */
export function federationDeclaration({ name, configuration, source }) {
  const metadata = configuration?.metadata;
  if (
    metadata === undefined ||
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  )
    return undefined;
  const federation = /** @type {Record<string, unknown>} */ (metadata)
    .federation;
  if (federation === undefined) return undefined;
  if (
    typeof federation !== "object" ||
    federation === null ||
    Array.isArray(federation)
  )
    reject(source, "declares a metadata.federation that is not an object");
  if (!remoteName.test(name))
    reject(
      source,
      `declares a federated remote named "${name}", which could not be an Nx project or a content-store subtree path`,
    );
  const alias = /** @type {Record<string, unknown>} */ (federation).alias;
  if (typeof alias !== "string" || !federationAlias.test(alias))
    reject(
      source,
      `declares the federation alias ${JSON.stringify(alias)}, which could not be a Module Federation container name`,
    );
  const boundaries = /** @type {Record<string, unknown>} */ (metadata)
    .boundaries;
  const tags =
    typeof boundaries === "object" && boundaries !== null
      ? /** @type {Record<string, unknown>} */ (boundaries)
          .onlyDependOnLibsWithTags
      : undefined;
  if (
    !Array.isArray(tags) ||
    tags.length === 0 ||
    tags.some((tag) => typeof tag !== "string" || !libraryTag.test(tag))
  )
    reject(
      source,
      "declares no metadata.boundaries.onlyDependOnLibsWithTags list of Nx tags, which is what its scope: module boundary is built from",
    );
  return {
    name,
    alias: /** @type {string} */ (alias),
    onlyDependOnLibsWithTags: [.../** @type {string[]} */ (tags)],
  };
}

/**
 * Every remote the workspace declares, by project name.
 *
 * @param {readonly DeclaredProject[]} projects
 * @returns {FederationRemote[]}
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
  const aliases = new Map();
  for (const remote of remotes) {
    const claimed = aliases.get(remote.alias);
    if (claimed !== undefined)
      throw new Error(
        `${claimed} and ${remote.name} both declare the federation alias "${remote.alias}", so one container would overwrite the other. Give each remote its own alias and rerun just check.`,
      );
    aliases.set(remote.alias, remote.name);
  }
  return remotes;
}

/**
 * The canonical remote registry: each remote's project name mapped to the
 * federation alias it publishes under. This is the fact
 * `libs/build-config/src/remotes.json` serializes.
 *
 * @param {readonly FederationRemote[]} remotes
 * @returns {Record<string, string>}
 */
export function remoteRegistry(remotes) {
  return Object.fromEntries(remotes.map(({ name, alias }) => [name, alias]));
}

/**
 * The `@nx/enforce-module-boundaries` constraint each remote declares for its
 * own `scope:` tag.
 *
 * @param {readonly FederationRemote[]} remotes
 */
export function moduleBoundaryConstraints(remotes) {
  return remotes.map(({ name, onlyDependOnLibsWithTags }) => ({
    sourceTag: `scope:${name}`,
    onlyDependOnLibsWithTags,
  }));
}

/**
 * One project as its `project.json` declares it. The file's own `name` is what
 * Nx registers the project under, so it is what every derived consumer keys on.
 *
 * @param {string} path
 * @returns {DeclaredProject}
 */
export function declaredProject(path) {
  const configuration = JSON.parse(readFileSync(path, "utf8"));
  const name = configuration?.name;
  if (typeof name !== "string" || !remoteName.test(name))
    reject(path, "declares no Nx project name");
  return { name, configuration, source: path };
}

/**
 * Every app project, read straight from disk. `eslint.config.mjs` resolves its
 * boundary constraints through this: the eslint run is what the project graph
 * is built for, so it cannot wait on one being built.
 *
 * @param {string} [root]
 * @returns {DeclaredProject[]}
 */
export function declaredAppProjects(root = "apps") {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${root}/${entry.name}/project.json`)
    .filter((path) => existsSync(path))
    .sort()
    .map(declaredProject);
}
