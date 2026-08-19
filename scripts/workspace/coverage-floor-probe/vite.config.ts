// The subject structure-contract.spec.ts proves its coverage-floor contract
// against: a component config that states a floor below the one AGENTS.md sets.
// Now that each project declares its own thresholds, a contract that only ever
// reads compliant configs would report green if it stopped reading them at all,
// so this is the config it is held to. It belongs to no Nx project, runs no
// tests, and is imported by that contract alone.
import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "coverage-floor-probe",
  dir: "scripts/workspace/coverage-floor-probe",
  thresholds: { lines: 90, functions: 95, branches: 90, statements: 95 },
});
