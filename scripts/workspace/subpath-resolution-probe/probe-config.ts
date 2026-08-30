// The one statement of the probe's component config. Two configs run this
// probe and the only thing they may differ in is the order the `remotes` map
// is written in, so everything else about them — the project, the directory,
// the coverage floor, and the two remotes themselves — is stated here once and
// read by both. Restating it in each config would leave a second difference
// free to appear between them, and a pair that differs in two things reports
// nothing about either.
import {
  defineWorkspaceTestConfig,
  type WorkspaceTestConfig,
} from "@site/testing";

/**
 * The remotes the probe's host states, in the order this file writes them.
 * Each is a stand-in the way every host's own test config states them. The
 * second is deliberately a specifier `@site/build-config` also publishes: it is
 * the one place a remote and a package manifest could both answer, and the
 * remote the caller stated has to win there. Keep at least two entries, or
 * `reversed` below stops being a different order and the pair stops saying
 * anything about order.
 */
export const probeRemotes: Record<string, string> = {
  "homeCards/Skeleton":
    "scripts/workspace/subpath-resolution-probe/src/stands-in-for-a-remote.ts",
  "@site/build-config/remote-registry":
    "scripts/workspace/subpath-resolution-probe/src/shadows-a-published-subpath.ts",
};

/** The same map, stated the other way round. This is the whole difference. */
export function reversed(
  remotes: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(Object.entries(remotes).reverse());
}

/** The probe's config, under whichever order of that map is asked for. */
export function probeConfig(
  remotes: Record<string, string>,
): WorkspaceTestConfig {
  return defineWorkspaceTestConfig({
    project: "subpath-resolution-probe",
    dir: "scripts/workspace/subpath-resolution-probe",
    thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    remotes,
  });
}
