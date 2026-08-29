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
});
