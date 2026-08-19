import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "e2e-harness",
  dir: "libs/e2e-harness",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  coverageInclude: [
    "libs/e2e-harness/src/config.ts",
    "libs/e2e-harness/src/site-contract.ts",
  ],
});
