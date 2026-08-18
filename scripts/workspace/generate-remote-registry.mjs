import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  declaredProject,
  federationRemotes,
  remoteGrammar,
  remoteRegistry,
} from "./federation-registry.mjs";

// llmlint: ignore-file[changed_behavior_has_e2e] This generator has no browser interface: it writes a build input, and a registry it would refuse is one no artifact can be built from, so there is nothing for a visitor to observe. federation-registry.spec.ts drives this real CLI through `just` over the committed tree and over a tree whose remote declaration has drifted, and site.spec.ts plus every feature journey drive the artifact the registry configures.

/**
 * Writes `libs/build-config/src/remotes.json` from the Nx project graph.
 *
 * The registry stays a real file because five consumers read it at run time —
 * `scripts/compose/compose.mjs`, `libs/artifact-contracts/src/remote-css.ts`,
 * `scripts/visual/verify-visual-contract.mjs`,
 * `scripts/artifact/check-static-artifact.mjs`, and `libs/publish-config` —
 * and none of them can build a project graph to ask. So it is generated from
 * the graph instead of maintained beside it, and `just lint-workflows` runs
 * `--check` to fail a push whose committed file disagrees with what the graph
 * produces.
 *
 * Which remotes exist and what each publishes under is the derived fact. The
 * order the keys are serialized in is not: every consumer reads the registry as
 * a mapping, so regeneration keeps the order the committed file already has and
 * appends remotes it does not yet name, rather than churning the file each time
 * the derivation's own iteration order changes.
 */

const registryPath = "libs/build-config/src/remotes.json";
const workspaceDirectory = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;

// Every failure below carries its own next action, because they do not share
// one: a misspelled flag, a graph Nx would not resolve, a project declaration
// this CLI refuses, and a committed registry that no longer reads back are each
// corrected somewhere different. Naming one remedy here sent a contributor to a
// declaration for failures that name no declaration at all.
process.on("uncaughtException", (error) => {
  console.error(
    `generate-remote-registry: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});

/** Every project Nx resolves, with the configuration the graph carries. */
function graphProjects() {
  const directory = mkdtempSync(join(tmpdir(), "remote-registry-"));
  try {
    const file = join(directory, "graph.json");
    try {
      execFileSync("pnpm", ["exec", "nx", "graph", `--file=${file}`], {
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (error) {
      // Nx reports a refused federation declaration through the plugin that
      // reads it, on its own stderr. Dropping that here would leave the reason
      // the registry could not be derived unreported.
      throw new Error(
        `the project graph could not be resolved: ${`${error.stderr ?? ""}${error.stdout ?? ""}`.trim() || error.message}. Fix what that reason names, then rerun just generate-remote-registry.`,
      );
    }
    const graph = JSON.parse(readFileSync(file, "utf8"));
    const nodes = graph?.graph?.nodes;
    if (typeof nodes !== "object" || nodes === null || Array.isArray(nodes))
      throw new Error(
        "nx graph printed no project nodes, so no remote registry could be derived from it. Run just bootstrap to restore the workspace's pinned Nx, then rerun just generate-remote-registry.",
      );
    // A node carries the configuration every projection below reads and a root
    // that names the file every diagnostic points a contributor at, so each is
    // narrowed here rather than trusted because Nx printed it; the
    // configuration's own fields are narrowed by the one boundary every reader
    // of a project goes through.
    return Object.entries(nodes).map(([name, node]) => {
      if (typeof node !== "object" || node === null || Array.isArray(node))
        throw new Error(
          `nx graph reported the project ${JSON.stringify(name)} as ${JSON.stringify(node)}, which is not a project node. Run just bootstrap to restore the workspace's pinned Nx, then rerun just generate-remote-registry.`,
        );
      const data = node.data;
      if (typeof data !== "object" || data === null || Array.isArray(data))
        throw new Error(
          `nx graph reported the project ${JSON.stringify(name)} with no project configuration to derive a remote from. Run just bootstrap to restore the workspace's pinned Nx, then rerun just generate-remote-registry.`,
        );
      const root = data.root;
      if (typeof root !== "string" || !workspaceDirectory.test(root))
        throw new Error(
          `nx graph reported the project ${JSON.stringify(name)} at ${JSON.stringify(root)}, which is not a workspace-relative directory. Run just bootstrap to restore the workspace's pinned Nx, then rerun just generate-remote-registry.`,
        );
      return declaredProject(data, `${root}/project.json`);
    });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

/** The registry as it is committed, or `undefined` when there is no file yet. */
function committedRegistry() {
  try {
    return readFileSync(registryPath, "utf8");
  } catch (error) {
    // An absent file is a registry nobody has generated yet, which this run is
    // about to. Every other read failure is this CLI's to report: swallowed, it
    // reaches the contributor under --check as a generic disagreement with the
    // graph, which sends them to a derivation that is correct.
    if (error?.code === "ENOENT") return undefined;
    throw new Error(
      `${registryPath} could not be read: ${error instanceof Error ? error.message : String(error)}. Restore that path from git, or delete it to have this run write it, then rerun just generate-remote-registry.`,
    );
  }
}

/**
 * The key order the committed registry already uses, so a regeneration that
 * derives the same remotes rewrites no bytes.
 *
 * @param {string | undefined} committed
 */
function committedOrder(committed) {
  if (committed === undefined) return [];
  let parsed;
  try {
    parsed = JSON.parse(committed);
  } catch (error) {
    // The order is cosmetic, but a committed file that does not parse is a
    // finding of its own, and reporting it as drift would name the wrong cause.
    throw new Error(
      `${registryPath} is not readable as JSON: ${error instanceof Error ? error.message : String(error)}. Restore it with git checkout ${registryPath}, then rerun just generate-remote-registry.`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error(
      `${registryPath} is not a JSON object mapping each remote's project name to its federation alias. Restore it with git checkout ${registryPath}, then rerun just generate-remote-registry.`,
    );
  // Only the keys are read from here, and only to order the derivation's own,
  // but this file is an arbitrary document until something narrows it: the
  // grammars it is held to are the ones it was written under, so a registry a
  // consumer could not read back is reported here rather than reordering by it.
  for (const [name, alias] of Object.entries(parsed))
    if (
      !remoteGrammar.remoteName.test(name) ||
      typeof alias !== "string" ||
      !remoteGrammar.federationAlias.test(alias)
    )
      throw new Error(
        `${registryPath} maps ${JSON.stringify(name)} to ${JSON.stringify(alias)}, which is not a remote's project name and the Module Federation container it publishes under. Restore it with git checkout ${registryPath}, then rerun just generate-remote-registry.`,
      );
  return Object.keys(parsed);
}

/**
 * The registry serialized in the committed file's own key order, with remotes
 * that file does not name appended in project-name order.
 *
 * @param {Record<string, string>} registry
 * @param {readonly string[]} order
 */
function serializeRemoteRegistry(registry, order) {
  const names = [
    ...order.filter((name) => name in registry),
    ...Object.keys(registry).filter((name) => !order.includes(name)),
  ];
  const ordered = Object.fromEntries(
    names.map((name) => [name, registry[name]]),
  );
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

// The absence of --check is what selects the mutating path, so an argument this
// CLI does not recognise cannot be ignored: a misspelled flag would rewrite the
// committed registry while its author waited to be told whether it had drifted.
const invocation = process.argv.slice(2);
const unrecognized = invocation.filter((argument) => argument !== "--check");
if (unrecognized.length > 0)
  throw new Error(
    `takes only --check, which reports whether ${registryPath} still agrees with the project graph, and not ${unrecognized.map((argument) => JSON.stringify(argument)).join(", ")}; with no argument it rewrites that file. Correct the argument, then rerun just generate-remote-registry.`,
  );

const checking = invocation.includes("--check");
const committed = committedRegistry();
const generated = serializeRemoteRegistry(
  remoteRegistry(federationRemotes(graphProjects())),
  committedOrder(committed),
);

if (checking) {
  if (committed !== generated) {
    console.error(
      `generate-remote-registry: ${registryPath} disagrees with the remotes the project graph declares. Rerun just generate-remote-registry and commit the result.`,
    );
    process.exit(1);
  }
  console.log(
    `remote registry matches the project graph: ${Object.keys(JSON.parse(generated)).join(", ")}`,
  );
} else {
  writeFileSync(registryPath, generated);
  console.log(
    `wrote ${registryPath}: ${Object.keys(JSON.parse(generated)).join(", ")}`,
  );
}
