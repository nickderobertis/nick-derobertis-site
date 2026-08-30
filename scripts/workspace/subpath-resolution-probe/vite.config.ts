// The subject subpath-resolution.spec.ts drives its test-runner half against: a
// component config the shared harness produced, which is the configuration
// every app and library is tested under. The specifiers the probe beside this
// file imports have to resolve through that harness rather than through the
// hand-written node configs the tooling projects use, so the probe runs under
// its own harness-produced config rather than beside the contract that drives
// it. It belongs to no Nx project and is run by that contract alone.
import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "subpath-resolution-probe",
  dir: "scripts/workspace/subpath-resolution-probe",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  // The remotes a host states are the only aliases this harness still merges,
  // and each of these is a stand-in the way every host's own test config states
  // them. The second one is deliberately a specifier `@site/build-config` also
  // publishes: it is the one place a remote and a package manifest could both
  // answer, and the remote the caller stated has to win there. The reversed
  // config beside this file states the same map in the opposite order and the
  // contract runs the probe under both, so keep the two entries in step.
  remotes: {
    "homeCards/Skeleton":
      "scripts/workspace/subpath-resolution-probe/src/stands-in-for-a-remote.ts",
    "@site/build-config/remote-registry":
      "scripts/workspace/subpath-resolution-probe/src/shadows-a-published-subpath.ts",
  },
});
