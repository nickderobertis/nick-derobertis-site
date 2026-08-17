import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  declaredProject,
  federationRemotes,
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

process.on("uncaughtException", (error) => {
  console.error(
    `generate-remote-registry: ${error instanceof Error ? error.message : String(error)}; correct the declaration named above, then rerun just generate-remote-registry`,
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
        `the project graph could not be resolved: ${`${error.stderr ?? ""}${error.stdout ?? ""}`.trim() || error.message}`,
      );
    }
    const graph = JSON.parse(readFileSync(file, "utf8"));
    const nodes = graph?.graph?.nodes;
    if (typeof nodes !== "object" || nodes === null || Array.isArray(nodes))
      throw new Error(
        "nx graph printed no project nodes, so no remote registry could be derived from it",
      );
    // A node's root names the file every diagnostic below points a contributor
    // at, so it is narrowed to a workspace-relative directory here rather than
    // trusted because Nx printed it; the configuration itself is narrowed by
    // the one boundary every reader of a project goes through.
    return Object.entries(nodes).map(([name, node]) => {
      const root = node?.data?.root;
      if (typeof root !== "string" || !workspaceDirectory.test(root))
        throw new Error(
          `nx graph reported the project ${JSON.stringify(name)} at ${JSON.stringify(root)}, which is not a workspace-relative directory`,
        );
      return declaredProject(node.data, `${root}/project.json`);
    });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

/** The registry as it is committed, or `undefined` when there is no file yet. */
function committedRegistry() {
  try {
    return readFileSync(registryPath, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * The registry serialized in the committed file's own key order, with remotes
 * that file does not name appended in project-name order.
 *
 * @param {Record<string, string>} registry
 * @param {string | undefined} committed
 */
function serializeRemoteRegistry(registry, committed) {
  let order = [];
  try {
    const parsed = committed === undefined ? {} : JSON.parse(committed);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed))
      order = Object.keys(parsed);
  } catch {
    // An unreadable committed file orders nothing; the derivation still does.
    order = [];
  }
  const names = [
    ...order.filter((name) => name in registry),
    ...Object.keys(registry).filter((name) => !order.includes(name)),
  ];
  const ordered = Object.fromEntries(
    names.map((name) => [name, registry[name]]),
  );
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

const checking = process.argv.includes("--check");
const committed = committedRegistry();
const generated = serializeRemoteRegistry(
  remoteRegistry(federationRemotes(graphProjects())),
  committed,
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
