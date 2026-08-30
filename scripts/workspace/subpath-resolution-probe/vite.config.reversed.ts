// The same component config as `vite.config.ts` beside this file, differing in
// one thing only: the `remotes` map states its two entries in the opposite
// order. That map is the last ordered map any resolution in this workspace
// still depends on — the `paths` map whose key order used to decide which of
// two overlapping aliases won is gone — so `subpath-resolution.spec.ts` runs
// the probe under both configs and every answer the probe reads has to be the
// same one under each. Nothing else may differ between the two: a second
// difference would leave the pair proving nothing about order.
import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "subpath-resolution-probe",
  dir: "scripts/workspace/subpath-resolution-probe",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  remotes: {
    "@site/build-config/remote-registry":
      "scripts/workspace/subpath-resolution-probe/src/shadows-a-published-subpath.ts",
    "homeCards/Skeleton":
      "scripts/workspace/subpath-resolution-probe/src/stands-in-for-a-remote.ts",
  },
});
